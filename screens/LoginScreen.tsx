import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { supabase } from '../services/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';

// Ensure WebBrowser can handle redirects
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [loading, setLoading] = useState(false);

    const signInWithGoogle = async () => {
        setLoading(true);
        try {
            // Explicitly use the native scheme for Android
            const redirectUrl = Platform.OS === 'web'
                ? Linking.createURL('/google-auth')
                : 'com.alarmsmartcalendar.app://google-auth';
            console.log("Redirect URL:", redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: Platform.OS !== 'web',
                    scopes: 'https://www.googleapis.com/auth/calendar',
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });
            if (error) throw error;

            if (Platform.OS !== 'web' && data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
            }
        } catch (error: any) {
            Alert.alert('Login Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Deep Link Handler
    useEffect(() => {
        const handleUrl = async (event: { url: string }) => {
            if (Platform.OS !== 'web') {
                try {
                    await supabase.auth.getSession();
                } catch (e) { console.error(e); }
            }
        };
        const sub = Linking.addEventListener('url', handleUrl);
        Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });
        return () => sub.remove();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.iconCircle}>
                <Ionicons name="calendar" size={48} color="#4F46E5" />
            </View>

            <Text style={styles.title}>Smart Alarm</Text>
            <Text style={styles.subtitle}>Never miss a meeting again.</Text>

            <TouchableOpacity
                style={styles.button}
                onPress={signInWithGoogle}
                disabled={loading}
            >
                <Ionicons name="logo-google" size={20} color="white" style={{ marginRight: 10 }} />
                <Text style={styles.buttonText}>{loading ? 'Connecting...' : 'Sign in with Google'}</Text>
            </TouchableOpacity>

            {/* Debugging Info */}
            <View style={{ marginTop: 20, padding: 10, backgroundColor: '#eee', borderRadius: 8 }}>
                <Text style={{ fontSize: 10, color: '#555' }}>Debug: {Linking.createURL('/google-auth')}</Text>
                {loading && <Text style={{ fontSize: 10, color: 'blue' }}>Status: Loading...</Text>}
            </View>

            <Text style={styles.footer}>Powered by Supabase & Expo</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 30,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginBottom: 60,
        textAlign: 'center',
    },
    button: {
        flexDirection: 'row',
        backgroundColor: '#111827', // Dark button
        width: '100%',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        marginTop: 50,
        color: '#9CA3AF',
        fontSize: 12,
    }
});
