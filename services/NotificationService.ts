import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { DeviceEventEmitter } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true
    }),
});

// Track active timers to allow rescheduling on Web
const activeTimers = new Map<string, { timerId?: any, triggerTime: number, meetingLink?: string | null }>();

export async function requestNotificationPermissions() {
    if (Platform.OS === 'web') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === 'granted';
}

export async function scheduleNotification(title: string, body: string, triggerDate: Date, data: any = {}, accountEmail: string = "Unknown", eventStartTime: number | null = null) {
    const now = Date.now();
    const diff = triggerDate.getTime() - now;

    if (Platform.OS === 'web') {
        let timerId;
        if (diff <= 0) {
            // Immediate
            new Notification(title, { body, icon: '/icon.png' });
            DeviceEventEmitter.emit('ALARM_TRIGGERED', {
                id: data?.id || String(now), // Use DB ID if available to match processedIds
                title,
                body,
                account_email: accountEmail,
                event_start_time: eventStartTime,
                meeting_link: data?.meeting_link,
                trigger_time: now
            });
        } else {
            // Future
            timerId = setTimeout(() => {
                new Notification(title, { body, icon: '/icon.png' });
                DeviceEventEmitter.emit('ALARM_TRIGGERED', {
                    id: data?.id || String(Date.now()), // Use DB ID if available
                    title,
                    body,
                    account_email: accountEmail,
                    event_start_time: eventStartTime,
                    meeting_link: data?.meeting_link,
                    trigger_time: Date.now()
                });
                // Remove from active timers when fired
                // We can't easily remove by ID here without passing ID, loop cleanup will handle it eventually or it stays until refresh
            }, diff);
        }
        console.log(`[Web] Scheduled native notification: ${title} in ${Math.round(diff / 1000)}s`);
        return timerId;
    }

    if (diff > 0) {
        // Future reminder: Schedule normally
        await Notifications.scheduleNotificationAsync({
            content: { title, body, data: { ...data, account_email: accountEmail, event_start_time: eventStartTime }, sound: 'default' },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate } as any,
        });
        console.log(`Scheduled: ${title} at ${triggerDate.toLocaleTimeString()}`);
    } else if (diff > -15 * 60 * 1000) {
        // Past reminder (within last 15 mins): Fire IMMEDIATELY
        await Notifications.scheduleNotificationAsync({
            content: { title: "Missed Reminder: " + title, body, data, sound: 'default' },
            trigger: null, // null trigger fires immediately
        });
        console.log(`Fired Changed Immediate: ${title}`);
        // await playAlarmSound(); -> Handled by Context via listener
    } else {
        console.log(`Skipped old reminder: ${title} (${Math.round(diff / 60000)}m ago)`);
    }
}

export async function syncReminders(userId: string, backendUrl: string) {
    try {
        // 1. Fetch upcoming reminders from backend
        const response = await fetch(`${backendUrl}/reminders/upcoming?user_id=${userId}`);
        const data = await response.json();
        const reminders = data.reminders || [];

        if (reminders.length === 0) return;

        // 2. Cancel all existing (only on mobile)
        if (Platform.OS !== 'web') {
            await Notifications.cancelAllScheduledNotificationsAsync();
        }

        console.log(`[Sync] Received ${reminders.length} reminders from backend.`);

        // 3. Schedule new ones
        for (const reminder of reminders) {
            const triggerTime = new Date(reminder.reminder_time);
            // console.log(`[Sync] Processing '${reminder.title}'. Trigger: ${triggerTime.toLocaleString()} (Device Time). Now: ${new Date().toLocaleString()}`);

            const isFuture = triggerTime.getTime() > Date.now();

            if (Platform.OS === 'web') {
                const newTriggerTime = triggerTime.getTime();
                const existing = activeTimers.get(reminder.id);
                // const linkChanged = existing?.meetingLink !== reminder.meeting_link; // This line will be implicitly handled

                if (existing) {
                    // Check if time is same AND link is same (or both null)
                    const timeMatch = Math.abs(existing.triggerTime - newTriggerTime) < 1000;
                    const linkMatch = existing.meetingLink === reminder.meeting_link;

                    if (timeMatch && linkMatch) {
                        console.log(`[Sync-Web] Skipping existing reminder (unchanged): ${reminder.title} (ID: ${reminder.id})`);
                        continue;
                    }

                    // Log why we are rescheduling
                    let reason = [];
                    if (!timeMatch) reason.push(`Time Diff: ${existing.triggerTime} vs ${newTriggerTime}`);
                    if (!linkMatch) reason.push(`Link Changed: ${existing.meetingLink} vs ${reminder.meeting_link}`);

                    if (existing.timerId) clearTimeout(existing.timerId);
                    console.log(`[Sync-Web] Rescheduling updated reminder [${reason.join(', ')}]: ${reminder.title}`);
                }
            } else {
                // Mobile
                if (!isFuture) {
                    // Immediate/Past - Check duplicate using activeTimers
                    if (activeTimers.has(reminder.id)) {
                        console.log(`[Sync-Mobile] Skipping handled immediate reminder: ${reminder.title}`);
                        continue;
                    }
                    // Mark as handled (timerId irrelevant)
                    activeTimers.set(reminder.id, { timerId: null, triggerTime: triggerTime.getTime(), meetingLink: reminder.meeting_link });
                }
            }

            // Perform Scheduling
            const timerId = await scheduleNotification(
                reminder.title, // Pass actual title instead of "Upcoming Event"
                `${reminder.title} starts at ${new Date(reminder.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                triggerTime,
                { eventId: reminder.id, meeting_link: reminder.meeting_link },
                reminder.account_email,
                new Date(reminder.start_time).getTime() // Pass start time for UI display
            );

            if (Platform.OS === 'web') {
                activeTimers.set(reminder.id, { timerId, triggerTime: triggerTime.getTime(), meetingLink: reminder.meeting_link });
            }
        }
        console.log(`Synced ${reminders.length} reminders.`);
        return reminders;
    } catch (error) {
        console.error("Failed to sync reminders:", error);
        return [];
    }
}

export async function cancelAllNotifications() {
    if (Platform.OS !== 'web') {
        await Notifications.cancelAllScheduledNotificationsAsync();
        activeTimers.clear(); // Clear mobile trackers too
    } else {
        // Web: Clear all active timeouts
        console.log(`[Web] Cancelling ${activeTimers.size} active notification timers.`);
        activeTimers.forEach((value) => {
            if (value.timerId) {
                clearTimeout(value.timerId);
            }
        });
        activeTimers.clear();
    }
}
