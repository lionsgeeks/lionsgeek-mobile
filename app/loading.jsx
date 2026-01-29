import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAppContext } from '@/context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '@/api';
import { Home as LogoIcon } from '@/components/logo';
import { useColorScheme } from '@/hooks/useColorScheme';
import { registerForPushNotificationsAsync, sendPushTokenToBackend } from '@/services/pushNotifications';

export default function LoadingScreen() {
  const { saveAuth } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const verifyAndLogin = async () => {
      try {
        // Check onboarding
        const seen = await AsyncStorage.getItem('onboarding_seen');
        if (seen !== '1') {
          console.log('[LOADING] Onboarding not seen, redirecting to onboarding');
          router.replace('/onboarding');
          return;
        }

        // Check token
        const token = await AsyncStorage.getItem('auth_token');
        const storedUser = await AsyncStorage.getItem('auth_user');
        
        console.log('[LOADING] Token check:', { 
          hasToken: !!token, 
          tokenType: typeof token,
          tokenValue: token ? `${token.substring(0, 20)}...` : 'null/empty',
          tokenLength: token?.length,
          isFalse: token === 'false' || token === false,
          isEmpty: token?.trim() === '',
          hasStoredUser: !!storedUser 
        });
        
        if (!token || token === 'false' || token === 'null' || token.trim() === '') {
          console.log('[LOADING] No valid token found, redirecting to login');
          await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
          router.replace('/auth/login');
          return;
        }

        // Verify token with backend
        try {
          const response = await API.getWithAuth('mobile/profile', token);
          
          if (response?.data) {
            // Token is valid, update user data from response
            // Handle different response formats: response.data or response.data.data or response.data.user
            let userData = response.data;
            if (response.data.data) {
              userData = response.data.data;
            } else if (response.data.user) {
              userData = response.data.user;
            }
            
            console.log('[LOADING] User data received:', JSON.stringify(userData, null, 2));
            
            // Store full user data
            await saveAuth(token, userData);
            
            // Register for push notifications and send token to backend
            try {
              const pushToken = await registerForPushNotificationsAsync();
              if (pushToken) {
                await sendPushTokenToBackend(pushToken, token);
              }
            } catch (error) {
              console.error('[LOADING] Error setting up push notifications:', error);
              // Don't block app flow if push notification setup fails
            }
            
            router.replace('/(tabs)');
          } else {
            // Token invalid, clear and go to login
            console.log('[LOADING] No data in response');
            await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
            router.replace('/auth/login');
          }
        } catch (error) {
          // Token verification failed
          console.log('[LOADING] Token verification failed:', error?.response?.data || error?.message);
          await AsyncStorage.multiRemove(['auth_token', 'auth_user']);
          router.replace('/auth/login');
        }
      } catch (error) {
        console.error('[LOADING] Error:', error);
        router.replace('/auth/login');
      }
    };

    verifyAndLogin();
  }, []);

  return (
    <View className={`flex-1 items-center justify-center bg-light dark:bg-dark`}>
      <LogoIcon color={isDark ? '#fff' : '#000'} width={120} height={120} />
      <Text className="text-3xl font-bold text-black dark:text-white mt-6 mb-2">
        LIONSGEEK
      </Text>
      <Text className="text-sm text-black/60 dark:text-white/60 mb-8">
        Loading...
      </Text>
      <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
    </View>
  );
}

