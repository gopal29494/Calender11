import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform, Linking } from 'react-native';
import { useAlarm } from '../context/AlarmContext';
import { Ionicons } from '@expo/vector-icons';


export default function AlarmOverlay() {
    const { currentAlarm, stopAlarm, snoozeAlarm } = useAlarm();

    if (!currentAlarm) return null;

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={!!currentAlarm}
            statusBarTranslucent={true}
        >
            <View style={styles.container}>
                <View style={styles.card}>
                    {/* Header Icon */}
                    <View style={styles.iconContainer}>
                        <Ionicons name="alarm" size={60} color="#fff" />
                    </View>

                    {/* Email / Source */}
                    <Text style={styles.emailLabel}>
                        {currentAlarm.account_email || "Unknown Account"}
                    </Text>

                    {/* Event Title */}
                    <Text style={styles.titleLabel}>
                        {currentAlarm.title}
                    </Text>

                    {/* Time (Formatted) - Use event time if available, else trigger time */}
                    <Text style={styles.timeLabel}>
                        {new Date(currentAlarm.event_start_time ?? currentAlarm.trigger_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>

                    {/* Buttons */}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={[styles.button, styles.snoozeButton]} onPress={snoozeAlarm}>
                            <Ionicons name="time-outline" size={24} color="#4B5563" />
                            <Text style={styles.snoozeText}>Snooze (5m)</Text>
                        </TouchableOpacity>

                        {/* Join Meeting Button Removed as per request */}
                        {/* Join Meeting Button */}
                        {currentAlarm.meeting_link && (
                            <TouchableOpacity
                                style={[styles.button, styles.joinButton]}
                                onPress={() => {
                                    stopAlarm();
                                    Linking.openURL(currentAlarm.meeting_link!);
                                }}
                            >
                                <Ionicons name="videocam" size={24} color="#fff" />
                                <Text style={styles.joinText}>Join Meeting</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={[styles.button, styles.stopButton]} onPress={stopAlarm}>
                            <Ionicons name="stop-circle-outline" size={24} color="#fff" />
                            <Text style={styles.stopText}>Stop</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)', // Dark overlay
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#1F2937', // Dark gray card
        borderRadius: 30,
        padding: 30,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#EF4444', // Red for alarm
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#EF4444',
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    emailLabel: {
        color: '#9CA3AF',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 5,
        textAlign: 'center',
    },
    titleLabel: {
        color: '#F9FAFB',
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 10,
    },
    timeLabel: {
        color: '#EF4444',
        fontSize: 48,
        fontWeight: '200',
        marginBottom: 40,
    },
    buttonContainer: {
        width: '100%',
        gap: 15,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        borderRadius: 15,
        gap: 10,
    },
    snoozeButton: {
        backgroundColor: '#E5E7EB',
    },
    snoozeText: {
        color: '#374151',
        fontSize: 18,
        fontWeight: '700',
    },
    stopButton: {
        backgroundColor: '#DC2626',
    },
    stopText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    joinButton: {
        backgroundColor: '#059669', // Green
    },
    joinText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
});
