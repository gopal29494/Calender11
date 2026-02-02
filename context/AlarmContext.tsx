import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import * as Notifications from 'expo-notifications';
import { Vibration, DeviceEventEmitter } from 'react-native';
import { getBackendUrl } from '../services/Config';

interface Alarm {
    id: string;
    title: string;
    body: string;
    account_email: string; // The email associated with the event
    event_id?: string;
    sound?: string;
    trigger_time: number;
    event_start_time?: number; // Actual event start time
    meeting_link?: string; // Meeting link
}

interface AlarmContextType {
    alarmQueue: Alarm[];
    currentAlarm: Alarm | null;
    triggerAlarm: (alarm: Alarm) => void;
    stopAlarm: () => void;
    snoozeAlarm: () => void;
    isPlaying: boolean;
}

const AlarmContext = createContext<AlarmContextType>({} as AlarmContextType);

// Global sound object to manage single playback
let soundObject: Audio.Sound | null = null;

export const AlarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [alarmQueue, setAlarmQueue] = useState<Alarm[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const isLoadingAudio = useRef(false);
    const processedIds = useRef(new Set<string>());

    // Derived state
    const currentAlarm = alarmQueue.length > 0 ? alarmQueue[0] : null;

    // Effect: Play sound when there is a current alarm and we aren't playing yet
    useEffect(() => {
        if (currentAlarm && !isPlaying) {
            startAlarmSound();
        } else if (!currentAlarm && isPlaying) {
            stopAlarmSound();
        }
    }, [currentAlarm, isPlaying]);

    // Listen for global events (Web Bridge)
    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('ALARM_TRIGGERED', (alarmData: Alarm) => {
            console.log("Global Event Received:", alarmData);
            triggerAlarm(alarmData);
        });
        return () => sub.remove();
    }, []);



    // ... (imports)

    // ...

    // Poll for reminders every 30s
    useEffect(() => {
        const pollReminders = async () => {
            try {
                // Get current user
                const { data: { session } } = await import('../services/supabase').then(m => m.supabase.auth.getSession());
                if (!session?.user) return;

                const backendUrl = getBackendUrl();
                const response = await fetch(`${backendUrl}/reminders/upcoming?user_id=${session.user.id}`);
                const data = await response.json();

                if (data.reminders) {

                    // console.log(`Polling: Found ${data.reminders.length} reminders`);
                    data.reminders.forEach((r: any) => {
                        if (r.trigger_immediately) {
                            // console.log("Triggering IMMEDIATE alarm:", r.title);
                            triggerAlarm({
                                id: r.id,
                                title: r.title,
                                body: `Event starts at ${new Date(r.start_time).toLocaleTimeString()}`,
                                account_email: r.account_email,
                                event_id: r.event_id,
                                sound: r.sound,
                                trigger_time: Date.now(),
                                event_start_time: new Date(r.start_time).getTime(),
                                meeting_link: r.meeting_link
                            });
                        }
                    });
                }
            } catch (error) {
                console.error("Polling Error:", error);
            }
        };

        // Initial check
        pollReminders();

        // Interval
        const interval = setInterval(pollReminders, 60000); // Check every 60s (reduce load)
        return () => clearInterval(interval);
    }, []);

    const startAlarmSound = async () => {
        if (isLoadingAudio.current) return;
        isLoadingAudio.current = true;

        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
            });

            if (soundObject) {
                await soundObject.unloadAsync();
            }
            console.log("Loading alarm sound...");
            const { sound } = await Audio.Sound.createAsync(
                require('../assets/sounds/alarm.mp3'),
                { shouldPlay: true, isLooping: true }
            );
            soundObject = sound;
            setIsPlaying(true);
            Vibration.vibrate([1000, 1000, 1000], true); // Vibrate pattern, loop
        } catch (error) {
            console.error("Failed to start alarm sound:", error);
        } finally {
            isLoadingAudio.current = false;
        }
    };

    const stopAlarmSound = async () => {
        isLoadingAudio.current = true; // Block new starts
        try {
            if (soundObject) {
                // Try stop and unload
                try { await soundObject.stopAsync(); } catch (e) { }
                try { await soundObject.unloadAsync(); } catch (e) { }
                soundObject = null;
            }
            Vibration.cancel();
            setIsPlaying(false);
        } catch (error) {
            console.error("Failed to stop alarm sound:", error);
        } finally {
            isLoadingAudio.current = false;
        }
    };

    const triggerAlarm = (alarm: Alarm) => {
        if (processedIds.current.has(alarm.id)) {
            // console.log(`Skipping already processed alarm: ${alarm.id}`);
            return;
        }

        console.log("Triggering Alarm:", alarm);
        setAlarmQueue(prev => {
            // Avoid duplicates in queue
            if (prev.find(a => a.id === alarm.id)) return prev;
            return [...prev, alarm];
        });
    };

    const stopAlarm = () => {
        // Mark current as processed
        if (alarmQueue.length > 0) {
            const current = alarmQueue[0];
            processedIds.current.add(current.id);
            console.log(`Alarm stopped and marked processed: ${current.id}`);
        }

        // Remove current alarm (index 0)
        setAlarmQueue(prev => prev.slice(1));
    };

    const snoozeAlarm = async () => {
        if (!currentAlarm) return;

        console.log(`Snoozing ${currentAlarm.title} for 5 minutes...`);

        // 1. Schedule a new notification for 5 mins later
        const triggerDate = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        // Critical: Must use a NEW ID so processedIds doesn't block it when it fires
        const snoozeId = `${currentAlarm.id}_snooze_${Date.now()}`;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Snoozed: " + currentAlarm.title,
                body: currentAlarm.body,
                data: { ...currentAlarm, id: snoozeId, snoozed: true }, // Override ID
                sound: 'default'
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate } as any,
        });

        // 2. Remove from queue (Stop current instance)
        // This adds currentAlarm.id (Original ID) to processedIds, preventing the OLD one from re-firing
        // But the NEW one (snoozeId) will be allowed.
        stopAlarm();
    };

    return (
        <AlarmContext.Provider value={{ alarmQueue, currentAlarm, triggerAlarm, stopAlarm, snoozeAlarm, isPlaying }}>
            {children}
        </AlarmContext.Provider>
    );
};

export const useAlarm = () => useContext(AlarmContext);
