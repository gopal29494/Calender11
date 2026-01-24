import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';

// Screens
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import AlarmScreen from './screens/AlarmScreen';
import { AlarmProvider, useAlarm } from './context/AlarmContext';
import AlarmOverlay from './components/AlarmOverlay';
import * as Notifications from 'expo-notifications';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Alarm: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          height: 60,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#4F46E5', // Indigo
        tabBarInactiveTintColor: '#9CA3AF', // Gray
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// Component to bridge Notifications -> AlarmContext
function NotificationListener() {
  const { triggerAlarm } = useAlarm();

  useEffect(() => {
    // Foreground Listener
    const sub = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as any;
      if (data && !data.snoozed) { // Don't trigger full alarm for snoozed return? Or maybe yes.
        triggerAlarm({
          id: notification.request.identifier,
          title: notification.request.content.title || "Alarm",
          body: notification.request.content.body || "",
          account_email: data.account_email || "Unknown",
          event_start_time: data.event_start_time,
          meeting_link: data.meeting_link, // Pass meeting link
          trigger_time: Date.now()
        });
      }
    });

    // Background/Response Listener
    const subResponse = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      triggerAlarm({
        id: response.notification.request.identifier,
        title: response.notification.request.content.title || "Alarm",
        body: response.notification.request.content.body || "",
        account_email: data.account_email || "Unknown",
        event_start_time: data.event_start_time,
        meeting_link: data.meeting_link, // Pass meeting link
        trigger_time: Date.now()
      });
    });

    return () => {
      sub.remove();
      subResponse.remove();
    };
  }, []);

  return null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <AlarmProvider>
      <NotificationListener />
      <AlarmOverlay />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {session && session.user ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="Alarm" component={AlarmScreen} options={{ presentation: 'fullScreenModal' }} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AlarmProvider>
  );
}
