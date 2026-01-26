import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Image, Platform, Alert, TouchableOpacity, Linking } from 'react-native';
import { supabase } from '../services/supabase';
import { Session } from '@supabase/supabase-js';
import { Ionicons } from '@expo/vector-icons';
import { syncReminders, scheduleNotification, requestNotificationPermissions } from '../services/NotificationService';
import EventSettingsModal from '../components/EventSettingsModal';

export default function HomeScreen() {
    const [session, setSession] = useState<Session | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<any>(null); // For modal
    const [modalVisible, setModalVisible] = useState(false);

    useEffect(() => {
        requestNotificationPermissions().then(granted => {
            if (!granted) console.log("⚠️ Notification Permissions Denied!");
            else console.log("✅ Notification Permissions Granted");
        });
    }, []);

    const addLog = (msg: string) => {
        console.log(msg);
    };

    const lastFetchTime = React.useRef(0);

    const getBackendUrl = () => {
        if (Platform.OS === 'web') {
            const hostname = window.location.hostname;
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'http://localhost:8000';
            }
            return 'https://calender11.onrender.com';
        }
        if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
        return 'https://calender11.onrender.com';
    };

    const fetchRealEvents = async (currentSession: Session | null) => {
        if (!currentSession?.user?.id) return;

        try {
            setLoading(true);
            const backendUrl = getBackendUrl();

            // 1. SYNC (Background Update)
            // Fire and forget or await? Await to ensure we get latest, but don't fail display if it fails.
            addLog("Syncing with Google...");
            try {
                await fetch(`${backendUrl}/calendar/fetch-from-google`, {
                    headers: {
                        'X-User-Id': currentSession.user.id,
                        'X-Google-Token': currentSession.provider_token || '',
                        'X-Google-Refresh-Token': currentSession.provider_refresh_token || ''
                    }
                });
            } catch (e) {
                addLog("Sync warning: " + e);
            }

            // 2. FETCH FROM DB (Stable Source)
            addLog("Fetching events from DB...");
            const dbResponse = await fetch(`${backendUrl}/calendar/events?user_id=${currentSession.user.id}`);

            if (dbResponse.ok) {
                const data = await dbResponse.json();
                const allEvents = data.events || [];
                setEvents(allEvents);
                addLog(`Loaded ${allEvents.length} events from DB.`);
            } else {
                addLog(`DB Fetch Error: ${dbResponse.status}`);
            }

        } catch (error: any) {
            addLog("Fetch Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            setSession(initialSession);
            if (initialSession?.user) {
                addLog("Session found: " + initialSession.user.email);
                fetchRealEvents(initialSession);
                const backendUrl = getBackendUrl();
                syncReminders(initialSession.user.id, backendUrl);
            } else {
                addLog("No session found.");
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
            setSession(updatedSession);
            if (updatedSession?.user) {
                addLog("Auth Change: Session updated.");
                fetchRealEvents(updatedSession);
                const backendUrl = getBackendUrl();
                syncReminders(updatedSession.user.id, backendUrl);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!session?.user) return;
        const backendUrl = getBackendUrl();
        const interval = setInterval(() => {
            console.log("Auto-syncing reminders...");
            syncReminders(session.user.id, backendUrl);
        }, 60000);
        return () => clearInterval(interval);
    }, [session]);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        if (session?.user) {
            fetchRealEvents(session).then(async () => {
                const backendUrl = getBackendUrl();
                await syncReminders(session.user.id, backendUrl);
                setRefreshing(false);
            });
        } else {
            setRefreshing(false);
        }
    }, [session]);

    const handleEventSettings = (event: any) => {
        setSelectedEvent(event);
        setModalVisible(true);
    };

    const handleSyncAfterSave = async () => {
        if (session?.user) {
            const backendUrl = getBackendUrl();
            await syncReminders(session.user.id, backendUrl);
            addLog("Settings updated & reminders re-synced.");
        }
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning,';
        if (hour < 18) return 'Good Afternoon,';
        return 'Good Evening,';
    };

    const formatEventTime = (dateStr: string) => {
        if (!dateStr) return '';
        if (!dateStr.includes('T')) return 'All Day';
        try {
            const date = new Date(dateStr);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{getGreeting()}</Text>
                    <Text style={styles.username}>
                        {session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'User'}
                    </Text>
                </View>
                {session?.user?.user_metadata?.avatar_url ? (
                    <Image
                        source={{ uri: session.user.user_metadata.avatar_url }}
                        style={styles.avatar}
                    />
                ) : (
                    <View style={[styles.avatar, { justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="person" size={24} color="#9CA3AF" />
                    </View>
                )}
            </View>

            {loading ? (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>Fetching your latest events...</Text>
            ) : events.length === 0 ? (
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>
                    {session ? "No events found for today." : "Please sign in to see events."}
                </Text>
            ) : (
                (() => {
                    let lastDate = '';
                    const todayStr = new Date().toDateString();

                    return events.map((event, index) => {
                        const eventDate = new Date(event.start);
                        const dateStr = eventDate.toDateString();
                        const showHeader = dateStr !== lastDate;
                        lastDate = dateStr;

                        let headerTitle = '';
                        if (showHeader) {
                            const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'long' });
                            const dateNum = eventDate.toLocaleDateString('en-GB'); // dd/mm/yyyy

                            if (dateStr === todayStr) {
                                headerTitle = `Today (${dateNum})`;
                            } else {
                                headerTitle = `${dayName} (${dateNum})`;
                            }
                        }

                        return (
                            <React.Fragment key={`${event.source}_${event.id}_${event.start}`}>
                                {showHeader && (
                                    <Text style={[styles.sectionTitle, { marginTop: index === 0 ? 0 : 20 }]}>
                                        {headerTitle}
                                    </Text>
                                )}
                                <View style={styles.eventCard}>
                                    <View style={[styles.colorStrip, { backgroundColor: event.color }]} />
                                    <View style={styles.eventDetails}>
                                        <Text style={styles.eventTime}>{formatEventTime(event.start)}</Text>
                                        <Text style={styles.eventTitle}>{event.title}</Text>
                                        <View style={styles.metaRow}>
                                            <Ionicons name="time-outline" size={14} color="#6B7280" />
                                            <Text style={styles.metaText}>{event.duration}</Text>
                                            <View style={[styles.dot, { backgroundColor: '#D1D5DB' }]} />
                                            <Text style={styles.calendarTag}>{event.source}</Text>
                                        </View>
                                        {event.meeting_link && (
                                            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }} onPress={() => Linking.openURL(event.meeting_link)}>
                                                <Ionicons name="videocam" size={16} color="#4F46E5" />
                                                <Text style={{ marginLeft: 4, color: '#4F46E5', fontWeight: 'bold', fontSize: 13 }}>Join Meeting</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    <View style={styles.reminderBadge}>
                                        <TouchableOpacity onPress={() => handleEventSettings(event)}>
                                            <Ionicons name="notifications-outline" size={20} color="#4F46E5" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </React.Fragment>
                        );
                    });
                })()
            )}

            <EventSettingsModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                event={selectedEvent}
                refreshEvents={handleSyncAfterSave}
                userId={session?.user?.id || ''}
            />

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        paddingTop: 60,
        backgroundColor: '#F9FAFB',
        flexGrow: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    greeting: {
        fontSize: 16,
        color: '#6B7280',
        fontWeight: '500',
    },
    username: {
        fontSize: 24,
        color: '#111827',
        fontWeight: '800',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#E5E7EB',
    },
    alarmCard: {
        backgroundColor: '#4F46E5',
        borderRadius: 24,
        padding: 24,
        marginBottom: 40,
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    alarmHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
    },
    alarmLabel: {
        color: '#E0E7FF',
        fontSize: 16,
        fontWeight: '600',
    },
    alarmTime: {
        fontSize: 48,
        fontWeight: '800',
        color: 'white',
    },
    alarmSub: {
        color: '#C7D2FE',
        marginTop: 5,
        fontSize: 14,
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 15,
    },
    eventCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        marginBottom: 15,
        flexDirection: 'row',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    colorStrip: {
        width: 6,
        height: '100%',
    },
    eventDetails: {
        flex: 1,
        padding: 16,
    },
    eventTime: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '600',
        marginBottom: 4,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 8,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 4,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        marginHorizontal: 8,
    },
    calendarTag: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    reminderBadge: {
        padding: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
