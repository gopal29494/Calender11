import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Audio } from 'expo-av';

const { width } = Dimensions.get('window');

export default function AlarmScreen({ navigation }: { navigation: any }) {
    const [sound, setSound] = useState<Audio.Sound>();

    async function playSound() {
        console.log('Loading Sound');
        // Using a default system sound mechanism or a bundled asset would be better
        // For MVP we just simulate the interface
        // const { sound } = await Audio.Sound.createAsync( require('./assets/alarm.mp3') );
        // setSound(sound);
        // await sound.playAsync(); 
    }

    useEffect(() => {
        playSound();
        return () => {
            sound?.unloadAsync();
        };
    }, []);

    const handleDismiss = () => {
        sound?.stopAsync();
        navigation.replace('Home');
    };

    const handleSnooze = () => {
        sound?.stopAsync();
        // Logic to reschedule alarm for 10 mins later
        navigation.replace('Home');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.time}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={styles.label}>Morning Alarm</Text>

            <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.button, styles.snoozeButton]} onPress={handleSnooze}>
                    <Text style={styles.buttonText}>Snooze</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, styles.dismissButton]} onPress={handleDismiss}>
                    <Text style={styles.buttonText}>Dismiss</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    time: {
        fontSize: 80,
        color: '#fff',
        fontWeight: '200',
    },
    label: {
        fontSize: 24,
        color: '#aaa',
        marginTop: 10,
        marginBottom: 100,
    },
    buttonContainer: {
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
    },
    button: {
        width: width * 0.8,
        padding: 20,
        borderRadius: 50,
        alignItems: 'center',
    },
    snoozeButton: {
        backgroundColor: '#333',
    },
    dismissButton: {
        backgroundColor: '#ff3b30',
    },
    buttonText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
    },
});
