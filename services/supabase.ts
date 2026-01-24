import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

if (Platform.OS !== 'web') {
    require('react-native-url-polyfill/auto');
}

const supabaseUrl = 'https://kkwxcxnbrymlbztjoljk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtrd3hjeG5icnltbGJ6dGpvbGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczMzkxMzMsImV4cCI6MjA4MjkxNTEzM30.eYjEIAqds4X5XVpoK2wncyA6uU3U0pnma1_K4IRimLc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});
