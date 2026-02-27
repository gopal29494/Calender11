import { Platform } from 'react-native';
import * as Device from 'expo-device';

export const getBackendUrl = () => {
    if (Platform.OS === 'web') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:8000';
        }
        return 'https://calender11.onrender.com';
    }

    // Android: Use localhost with adb reverse for USB stability
    if (Platform.OS === 'android') {
        return 'http://localhost:8000';
    }

    // Physical Device or iOS Default (Development)
    return 'http://192.168.1.44:8000';
};