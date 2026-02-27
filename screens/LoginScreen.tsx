import React, { useState, useEffect } from 'react';
import Constants from 'expo-constants';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Image } from 'react-native';
import { supabase } from '../services/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';

// Ensure WebBrowser can handle redirects
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [loading, setLoading] = useState(false);

    // Helper to extract params
    const extractParamsFromUrl = (url: string) => {
        const params: { [key: string]: string } = {};
        // Handle both query (?) and hash (#)
        const regex = /[?&#]([^=#]+)=([^&#]*)/g;
        let match;
        while ((match = regex.exec(url))) {
            params[match[1]] = decodeURIComponent(match[2]);
        }
        return params;
    };

    const handleSessionFromUrl = async (url: string) => {
        try {
            const params = extractParamsFromUrl(url);
            if (params.access_token && params.refresh_token) {
                console.log("Found session tokens in URL, setting session...");
                const { error } = await supabase.auth.setSession({
                    access_token: params.access_token,
                    refresh_token: params.refresh_token,
                });
                if (error) throw error;
                console.log("Session set successfully");
            }
        } catch (e: any) {
            console.error("Error setting session from URL:", e.message);
            Alert.alert("Auth Error", "Failed to set session: " + e.message);
        }
    };

    // Deep Link Handler
    useEffect(() => {
        const handleUrl = async (event: { url: string }) => {
            console.log("Deep link received:", event.url);
            if (Platform.OS !== 'web') {
                await handleSessionFromUrl(event.url);
            }
        };
        const sub = Linking.addEventListener('url', handleUrl);
        Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });
        return () => sub.remove();
    }, []);

    const signInWithGoogle = async () => {
        setLoading(true);
        try {
            // Use Linking.createURL to support both Expo Go (exp://) and Production (com.app://)
            let redirectUrl = Linking.createURL('/google-auth');

            // FIX: AWS/Supabase redirects to custom scheme which Expo Go can't handle.
            // If we see the production scheme but we are in Expo Go, force 'exp://'
            if (redirectUrl.startsWith('com.alarmsmartcalendar.app')) {
                console.log('Detected production scheme in Expo Go. Attempting override...');
                const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
                if (hostUri) {
                    redirectUrl = `exp://${hostUri}/--/google-auth`;
                }
            }
            console.log("Final Redirect URL:", redirectUrl);

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
                if (result.type === 'success' && result.url) {
                    await handleSessionFromUrl(result.url);
                }
            }
        } catch (error: any) {
            Alert.alert('Login Error', error.message);
        } finally {
            setLoading(false);
        }
    };

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
