import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform, ScrollView, TextInput } from 'react-native';
import { supabase } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as NotificationService from '../services/NotificationService';

WebBrowser.maybeCompleteAuthSession();

// Available Options
const REMINDER_OPTIONS = [5, 10, 15, 30, 60];
const SOUND_OPTIONS = [
    { label: 'Default', value: 'default' },
    { label: 'Soft', value: 'soft' },
    { label: 'Loud', value: 'loud' },
];

export default function SettingsScreen() {
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    // Global Settings State
    const [reminderOffsets, setReminderOffsets] = useState<number[]>([30]);
    const [customTime, setCustomTime] = useState('');

    const [alarmSound, setAlarmSound] = useState<string>('default');
    const [settingsLoading, setSettingsLoading] = useState(true);

    // Use useFocusEffect to refresh every time the screen comes into view
    useFocusEffect(
        useCallback(() => {
            fetchAccounts();
            fetchSettings();

            // Optional: return cleanup function if needed
            return () => { };
        }, [])
    );

    // Format display (e.g. 60 min -> 1 hr)
    const formatDuration = (minutes: number) => {
        if (minutes >= 60 && minutes % 60 === 0) {
            const hrs = minutes / 60;
            return `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}`;
        }
        return `${minutes} min`;
    };

    // Helper for manual time save
    const handleCustomTimeSave = () => {
        const val = parseInt(customTime);

        if (isNaN(val) || val <= 0) {
            Alert.alert("Invalid Input", "Please enter a valid number of minutes.");
            return;
        }

        if (!reminderOffsets.includes(val)) {
            const newOffsets = [...reminderOffsets, val];
            saveSettings(newOffsets, alarmSound);
        }

        setCustomTime('');
    };

    // Helper to get Backend URL based on platform
    const getBackendUrl = () => {
        // For local development on Web
        if (Platform.OS === 'web') return 'http://localhost:8000';
        // For Android Emulator
        if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
        // Default/Prod
        return 'https://calender11.onrender.com';
    };

    const fetchSettings = async () => {
        setSettingsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const response = await fetch(`${getBackendUrl()}/reminders/settings?user_id=${user.id}`);
            const data = await response.json();

            if (response.ok && data) {
                // Support both old and new format
                const offsets = data.reminder_offsets || (data.global_reminder_offset_minutes ? [data.global_reminder_offset_minutes] : [30]);
                setReminderOffsets(offsets);
                setAlarmSound(data.default_alarm_sound || 'default');
            } else {
                // Reset to defaults if fetch fails or no data
                setReminderOffsets([30]);
                setAlarmSound('default');
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error);
            // Default on error
            setReminderOffsets([30]);
        } finally {
            setSettingsLoading(false);
        }
    };

    const saveSettings = async (newOffsets: number[], newSound: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Validation: Ensure at least one offset? Or allow empty? Allow empty is fine (no reminders)

        setReminderOffsets(newOffsets);
        setAlarmSound(newSound);

        try {
            const payload = {
                user_id: user.id,
                global_reminder_offset_minutes: newOffsets.length > 0 ? newOffsets[0] : 30, // Fallback
                reminder_offsets: newOffsets,
                default_alarm_sound: newSound
            };

            await fetch(`${getBackendUrl()}/reminders/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error("Failed to save settings:", error);
            Alert.alert("Error", "Failed to save settings");
        }
    };

    const toggleOffset = (min: number) => {
        let newOffsets = [...reminderOffsets];
        if (newOffsets.includes(min)) {
            newOffsets = newOffsets.filter(o => o !== min);
        } else {
            newOffsets.push(min);
        }
        saveSettings(newOffsets, alarmSound);
    };

    const fetchAccounts = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setAccounts([]);
            return;
        }

        // Fetch valid accounts (is_active is True or NULL)
        // If the migration hasn't run, this might fail.
        // But we rely on the backend now mostly? 
        // We can just filter on client side if column exists, or specific query.
        const { data, error } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true); // Only active accounts

        if (error) {
            console.error(error);
            // If error is likely column missing, fallback
            if (error.message.includes('column') && error.message.includes('active')) {
                const fallback = await supabase.from('connected_accounts').select('*').eq('user_id', user.id);
                setAccounts(fallback.data || []);
            }
        } else {
            setAccounts(data || []);
        }
    };

    const handleConnectAccount = async () => {
        setLoading(true);
        setStatus('Initiating Connection...');

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert("Error", "You must be logged in.");
                setLoading(false);
                return;
            }

            const backendUrl = getBackendUrl();
            const platformParam = Platform.OS === 'web' ? 'web' : 'native';

            // Calculate Redirect URL dynamically
            let redirectUrl = '';
            if (Platform.OS === 'web') {
                redirectUrl = window.location.origin;
            }
            // For native, usually we don't need it if we rely on deep links, but passing it won't hurt if backend handles it safely

            const initResponse = await fetch(`${backendUrl}/auth/google/url?user_id=${user.id}&platform=${platformParam}&redirect_url=${encodeURIComponent(redirectUrl)}`);
            const { url } = await initResponse.json();

            if (!url) throw new Error("Failed to get auth URL");

            const result = await WebBrowser.openAuthSessionAsync(url);
            console.log("Auth Result:", result);

            setStatus('Checking...');
            fetchAccounts();

        } catch (error: any) {
            console.error("Connection Error:", error);
            Alert.alert("Error", "Failed to connect account: " + error.message);
            setStatus('Failed');
        } finally {
            setLoading(false);
            setTimeout(() => setStatus(''), 3000);
        }
    };

    const removeAccount = async (email: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Perform Soft Delete via Backend
        try {
            const response = await fetch(`${getBackendUrl()}/auth/google/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, email: email })
            });

            if (!response.ok) {
                const txt = await response.text();
                throw new Error(txt || "Failed to disconnect");
            }

            Alert.alert("Success", "Account disconnected.");
            fetchAccounts();

        } catch (e: any) {
            console.error("Disconnect error:", e);
            Alert.alert("Error", "Failed to disconnect account: " + e.message);
        }
    };

    const handleSignOut = async () => {
        // Clear notifications before signing out to prevent next user from getting them
        await NotificationService.cancelAllNotifications();
        await supabase.auth.signOut();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
            <Text style={styles.title}>Global Settings</Text>

            {/* Reminder Time Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reminder Times</Text>
                <Text style={styles.sectionSubtitle}>Select multiple times to get notified.</Text>
                <View style={styles.optionsGrid}>
                    {REMINDER_OPTIONS.map((min) => (
                        <TouchableOpacity
                            key={min}
                            style={[
                                styles.optionButton,
                                reminderOffsets.includes(min) && styles.optionButtonSelected
                            ]}
                            onPress={() => toggleOffset(min)}
                        >
                            <Text style={[
                                styles.optionText,
                                reminderOffsets.includes(min) && styles.optionTextSelected
                            ]}>{min} min</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Manual Entry */}
                <Text style={[styles.sectionSubtitle, { marginTop: 15, marginBottom: 5 }]}>Add custom time:</Text>
                <View style={styles.manualInputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ex: 45"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="numeric"
                        value={customTime}
                        onChangeText={setCustomTime}
                    />
                    <TouchableOpacity style={styles.setButton} onPress={handleCustomTimeSave}>
                        <Text style={styles.setButtonText}>Add</Text>
                    </TouchableOpacity>
                </View>

                {/* Display active custom offsets that aren't in defaults */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {reminderOffsets.filter(o => !REMINDER_OPTIONS.includes(o)).map(o => (
                        <TouchableOpacity key={o} style={[styles.optionButton, styles.optionButtonSelected, { flexDirection: 'row', alignItems: 'center', gap: 5 }]} onPress={() => toggleOffset(o)}>
                            <Text style={styles.optionTextSelected}>{formatDuration(o)}</Text>
                            <Ionicons name="close-circle" size={16} color="white" />
                        </TouchableOpacity>
                    ))}
                </View>

            </View>

            {/* Alarm Sound Selection */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Alarm Sound</Text>
                <Text style={styles.sectionSubtitle}>Select the sound for your alarms.</Text>
                <View style={styles.optionsRow}>
                    {SOUND_OPTIONS.map((sound) => (
                        <TouchableOpacity
                            key={sound.value}
                            style={[
                                styles.optionButton,
                                alarmSound === sound.value && styles.optionButtonSelected,
                                { flex: 1 }
                            ]}
                            onPress={() => saveSettings(reminderOffsets, sound.value)}
                        >
                            <Text style={[
                                styles.optionText,
                                alarmSound === sound.value && styles.optionTextSelected
                            ]}>{sound.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.title}>Connected Accounts</Text>
            <FlatList
                data={accounts}
                scrollEnabled={false}
                keyExtractor={item => item.id?.toString() || item.email}
                renderItem={({ item }) => (
                    <View style={styles.accountCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Ionicons name="logo-google" size={20} color="#555" />
                            <Text style={styles.accountEmail}>{item.email}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeAccount(item.email)}>
                            <Ionicons name="trash-outline" size={20} color="red" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<Text style={{ color: '#999', marginBottom: 10 }}>No linked accounts yet.</Text>}
            />

            <TouchableOpacity
                style={[styles.addButton, loading && { opacity: 0.7 }]}
                onPress={handleConnectAccount}
                disabled={loading}
            >
                {loading ? <Text style={{ color: 'white' }}>Linking...</Text> : (
                    <>
                        <Ionicons name="add-circle" size={24} color="white" />
                        <Text style={styles.addButtonText}>Connect Google Account</Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={{ marginTop: 50, marginBottom: 20 }} onPress={handleSignOut}>
                <Text style={{ color: 'red', textAlign: 'center', fontSize: 16 }}>Sign Out of App</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#F9FAFB', paddingTop: 60 },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 15, color: '#111827' },
    section: { marginBottom: 25, backgroundColor: 'white', padding: 15, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 1 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 5 },
    sectionSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 15 },

    input: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, width: 80, textAlign: 'center', borderWidth: 1, borderColor: '#E5E7EB', color: '#374151' },
    timeInput: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, width: 60, textAlign: 'center', borderWidth: 1, borderColor: '#E5E7EB', color: '#374151', fontSize: 18 },
    colon: { fontSize: 24, fontWeight: 'bold', color: '#374151', paddingHorizontal: 5 },
    manualInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    setButton: { backgroundColor: '#4F46E5', padding: 12, borderRadius: 8 },
    setButtonText: { color: 'white', fontWeight: 'bold' },

    optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    optionsRow: { flexDirection: 'row', gap: 10 },

    optionButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center'
    },
    optionButtonSelected: {
        backgroundColor: '#4F46E5',
        borderColor: '#4F46E5'
    },
    optionText: { color: '#374151', fontWeight: '500' },
    optionTextSelected: { color: 'white', fontWeight: 'bold' },

    accountCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2
    },
    accountEmail: { fontSize: 16, color: '#374151' },
    addButton: {
        flexDirection: 'row',
        backgroundColor: '#4F46E5',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 10
    },
    addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 30 },
});
