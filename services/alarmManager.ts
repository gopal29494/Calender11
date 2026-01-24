import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notifications
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export const checkMorningAlarm = (enabled: boolean, navigation: any) => {
    if (!enabled) return;

    const now = new Date();
    const hours = now.getHours();

    // Check if it's between 5 AM and 9 AM
    if (hours >= 5 && hours < 9) {
        // In a real app, we would check if we ALREADY triggered it today
        // For demo/prototype, we rely on user manually enabling "Demo Morning Mode"
        // or a more persistent global state store.
    }
};

export const registerForPushNotificationsAsync = async () => {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // Request permissions...
};
