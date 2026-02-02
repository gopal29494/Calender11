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

    // Android: Check if real device or emulator
    if (Platform.OS === 'android') {
        if (!Device.isDevice) {
            // Emulator
            return 'http://10.0.2.2:8000';
        }
    }

    // Physical Device or iOS Default
    return 'https://calender11.onrender.com';
};
