import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { syncReminders } from './NotificationService';
import { getBackendUrl } from './Config';
import { supabase } from './supabase';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
        console.log("Starting Background Sync...");

        // Check auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
            console.log("Background Sync: No user session.");
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        const backendUrl = getBackendUrl();
        const reminders = await syncReminders(session.user.id, backendUrl);

        console.log(`Background Sync Completed. Found ${reminders?.length || 0} reminders.`);
        return reminders && reminders.length > 0
            ? BackgroundFetch.BackgroundFetchResult.NewData
            : BackgroundFetch.BackgroundFetchResult.NoData;

    } catch (error) {
        console.error("Background Sync Failed:", error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export async function registerBackgroundSync() {
    try {
        const status = await BackgroundFetch.getStatusAsync();
        // console.log("Background Fetch Status:", status);

        if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) {
            console.log("Background Fetch is restricted or denied");
            return;
        }

        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (isRegistered) {
            // console.log("Background Sync already registered.");
            return;
        }

        await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
            minimumInterval: 15 * 60, // 15 minutes
            stopOnTerminate: false, // Continue even if app is killed (best effort)
            startOnBoot: true, // Android only
        });
        console.log("Background Sync Task Registered!");
    } catch (err) {
        console.error("Task Register failed:", err);
    }
}
