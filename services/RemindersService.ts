import { Platform } from 'react-native';

const getBackendUrl = () => {
    return 'https://calender11.onrender.com';
};

export const getEventSettings = async (eventId: string) => {
    try {
        const response = await fetch(`${getBackendUrl()}/reminders/events/${eventId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch settings: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error getting event settings:", error);
        return null;
    }
};

export const updateEventSettings = async (eventId: string, offsets: number[], userId: string) => {
    try {
        const response = await fetch(`${getBackendUrl()}/reminders/events/${eventId}?user_id=${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ reminder_offsets: offsets }),
        });

        if (!response.ok) {
            throw new Error(`Failed to update settings: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error updating event settings:", error);
        return null;
    }
};

export const getSettings = async (userId: string) => {
    try {
        const response = await fetch(`${getBackendUrl()}/reminders/settings?user_id=${userId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch global settings: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Error getting global settings:", error);
        return null;
    }
};
