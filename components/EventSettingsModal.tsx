import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getEventSettings, updateEventSettings, getSettings } from '../services/RemindersService';

interface EventSettingsModalProps {
    visible: boolean;
    onClose: () => void;
    event: any; // The event object
    refreshEvents: () => void; // Call to refresh main list
    userId: string;
}

export default function EventSettingsModal({ visible, onClose, event, refreshEvents, userId }: EventSettingsModalProps) {
    const [loading, setLoading] = useState(false);
    const [offsets, setOffsets] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);

    // Time Selection State
    const [selectedHour, setSelectedHour] = useState('12');
    const [selectedMinute, setSelectedMinute] = useState('00');
    const [isAm, setIsAm] = useState(true);

    useEffect(() => {
        if (visible && event?.id) {
            loadSettings();
            // Default time selection to event time - 15 mins? Or just current time?
            // Let's default to event start time.
            if (event.start) {
                const startDate = new Date(event.start);
                let h = startDate.getHours();
                const m = startDate.getMinutes();
                const am = h < 12;
                if (h > 12) h -= 12;
                if (h === 0) h = 12;

                setSelectedHour(h.toString());
                setSelectedMinute(m.toString().padStart(2, '0'));
                setIsAm(am);
            }
        } else {
            setOffsets([]);
        }
    }, [visible, event]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const settings = await getEventSettings(event.id);
            // Fix: Check if it is an array (even empty), NOT if length > 0.
            // Empty array means "User explicitly deleted all reminders".
            // Null/Undefined means "No settings yet, use global defaults".
            if (settings && Array.isArray(settings.reminder_offsets)) {
                setOffsets(settings.reminder_offsets);
            } else {
                if (userId) {
                    const globalSettings = await getSettings(userId);
                    if (globalSettings && globalSettings.reminder_offsets) {
                        setOffsets(globalSettings.reminder_offsets);
                    } else {
                        setOffsets([30]); // Default fallback
                    }
                } else {
                    setOffsets([]);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const getEventDate = () => {
        if (!event?.start) return new Date();
        return new Date(event.start);
    };

    const handleAddTime = () => {
        try {
            let h = parseInt(selectedHour);
            const m = parseInt(selectedMinute);

            if (isNaN(h) || h < 1 || h > 12) {
                Alert.alert("Invalid Time", "Hour must be between 1 and 12.");
                return;
            }
            if (isNaN(m) || m < 0 || m > 59) {
                Alert.alert("Invalid Time", "Minute must be between 0 and 59.");
                return;
            }

            // Convert to 24h for calculation
            let hour24 = h;
            if (isAm && h === 12) hour24 = 0;
            if (!isAm && h !== 12) hour24 += 12;

            // Create Date object for the Reminder Time (Same Day as Event)
            const eventDate = getEventDate();
            const reminderDate = new Date(eventDate);
            reminderDate.setHours(hour24, m, 0, 0);

            // If reminder is AFTER event, maybe it's for the previous day? 
            // Usually reminders are BEFORE. 
            // If user sets 11 PM and event is 9 AM, assumy 11 PM previous day?
            // For simplicity, let's assume same day first.
            // Calculate difference in minutes.

            let diffMs = eventDate.getTime() - reminderDate.getTime();

            // If diff is negative (Reminder is AFTER event), warn user or assume previous day?
            if (diffMs < 0) {
                // Try subtracting 24 hours (previous day)
                const prevDay = new Date(reminderDate);
                prevDay.setDate(prevDay.getDate() - 1);
                const diffPrev = eventDate.getTime() - prevDay.getTime();

                Alert.alert(
                    "Reminder is after Event",
                    `Did you mean ${h}:${m.toString().padStart(2, '0')} ${isAm ? 'AM' : 'PM'} on the day BEFORE the event?`,
                    [
                        { text: "No, Cancel", style: "cancel" },
                        { text: "Yes", onPress: () => addOffset(Math.round(diffPrev / 60000)) }
                    ]
                );
                return;
            }

            const minutes = Math.round(diffMs / 60000);
            addOffset(minutes);

        } catch (e) {
            console.error(e);
        }
    };

    const addOffset = (minutes: number) => {
        if (offsets.includes(minutes)) {
            Alert.alert("Duplicate", "This reminder time is already set.");
            return;
        }
        setOffsets([...offsets, minutes].sort((a, b) => a - b));
    };

    const handleRemoveOffset = (index: number) => {
        const newArr = [...offsets];
        newArr.splice(index, 1);
        setOffsets(newArr);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateEventSettings(event.id, offsets);
            refreshEvents();
            onClose();
            Alert.alert("Success", "Reminders updated successfully.");
        } catch (e: any) {
            Alert.alert("Error", "Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const formatOffsetToTime = (minutes: number) => {
        const eventDate = getEventDate();
        const reminderDate = new Date(eventDate.getTime() - minutes * 60000);
        return reminderDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    };

    if (!visible) return null;

    return (
        <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <View style={styles.header}>
                        <Text style={styles.modalTitle}>Set Reminders</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#374151" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.eventTitle}>{event?.title}</Text>
                    <Text style={styles.eventTimeInfo}>
                        Event Time: {getEventDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>

                    {loading ? (
                        <ActivityIndicator size="large" color="#4F46E5" style={{ margin: 20 }} />
                    ) : (
                        <ScrollView style={styles.content}>

                            <Text style={styles.label}>Add Reminder Time:</Text>
                            <View style={styles.timePickerRow}>
                                <TextInput
                                    style={styles.timeInput}
                                    placeholder="12"
                                    keyboardType="numeric"
                                    value={selectedHour}
                                    onChangeText={setSelectedHour}
                                    maxLength={2}
                                />
                                <Text style={styles.colon}>:</Text>
                                <TextInput
                                    style={styles.timeInput}
                                    placeholder="00"
                                    keyboardType="numeric"
                                    value={selectedMinute}
                                    onChangeText={setSelectedMinute}
                                    maxLength={2}
                                />
                                <TouchableOpacity
                                    style={[styles.amPmButton, isAm && styles.amPmActive]}
                                    onPress={() => setIsAm(true)}>
                                    <Text style={[styles.amPmText, isAm && styles.amPmTextActive]}>AM</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.amPmButton, !isAm && styles.amPmActive]}
                                    onPress={() => setIsAm(false)}>
                                    <Text style={[styles.amPmText, !isAm && styles.amPmTextActive]}>PM</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.addButton} onPress={handleAddTime}>
                                <Ionicons name="add-circle" size={20} color="white" />
                                <Text style={styles.addButtonText}>Add Reminder</Text>
                            </TouchableOpacity>

                            <Text style={[styles.label, { marginTop: 20 }]}>Scheduled Reminders:</Text>
                            <View style={styles.chipContainer}>
                                {offsets.length === 0 && <Text style={{ fontStyle: 'italic', color: '#9CA3AF' }}>No reminders set.</Text>}
                                {offsets.map((off, index) => (
                                    <View key={index} style={styles.chip}>
                                        <Text style={styles.chipText}>
                                            {formatOffsetToTime(off)}
                                            <Text style={styles.chipSubText}> ({off}m before)</Text>
                                        </Text>
                                        <TouchableOpacity onPress={() => handleRemoveOffset(index)}>
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Save All</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4F46E5',
        marginBottom: 5,
    },
    eventTimeInfo: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
    },
    content: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 10,
    },
    timePickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        gap: 10,
    },
    timeInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 18,
        width: 60,
        textAlign: 'center',
        color: '#111827',
    },
    colon: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#374151',
    },
    amPmButton: {
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    amPmActive: {
        backgroundColor: '#4F46E5',
    },
    amPmText: {
        fontWeight: '600',
        color: '#374151',
    },
    amPmTextActive: {
        color: 'white',
    },
    addButton: {
        flexDirection: 'row',
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    addButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    chipContainer: {
        marginTop: 10,
        gap: 10,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#E0E7FF',
        borderRadius: 12,
        padding: 12,
    },
    chipText: {
        fontWeight: '600',
        color: '#374151',
        fontSize: 16,
    },
    chipSubText: {
        fontWeight: '400',
        fontSize: 12,
        color: '#6B7280',
    },
    footer: {
        marginTop: 10,
    },
    button: {
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButton: {
        backgroundColor: '#4F46E5',
    },
    saveButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
