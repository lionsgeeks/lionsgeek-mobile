import { useEffect } from 'react';
import { View } from 'react-native';
import { useAppContext } from '@/context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from '@/utils/authTokenStorage';
import API from '@/api';
import { Home as LogoIcon } from '@/components/logo';
import { useColorScheme } from '@/hooks/useColorScheme';
import { registerForPushNotificationsAsync, sendPushTokenToBackend, consumePendingNotificationNavigation, handleNotificationNavigation } from '@/services/pushNotifications';

export default function LoadingScreen() {
  const { saveAuth } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const verifyAndLogin = async () => {
      try {
        const token = await getAuthToken();
        const tokenStr = typeof token === 'string' ? token.trim() : '';
        const hasValidToken =
          !!tokenStr && tokenStr !== 'false' && tokenStr !== 'null' && tokenStr !== 'undefined';

        const seen = await AsyncStorage.getItem('onboarding_seen');

        if (seen !== '1' && !hasValidToken) {
          router.replace('/onboarding');
          return;
        }

        if (!hasValidToken) {
          router.replace('/auth/login');
          return;
        }

        const enterAppWithUser = async (userData) => {
          await saveAuth(tokenStr, userData);
          try {
            const pushToken = await registerForPushNotificationsAsync();
            if (pushToken) {
              await sendPushTokenToBackend(pushToken, tokenStr);
            }
            // VoIP PushKit registration lives in CallContext (single place + cleanup).
          } catch {
            // Push setup is optional; do not block app flow.
          }

          try {
            const pendingData = await consumePendingNotificationNavigation();
            if (pendingData) {
              router.replace('/(tabs)/home');
              setTimeout(() => handleNotificationNavigation(pendingData), 0);
              return;
            }
          } catch {
            // fall through to home
          }
          router.replace('/(tabs)/home');
        };

        const enterWithCacheOrStub = async () => {
          const cached = await AsyncStorage.getItem('auth_user');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed?.id != null) {
                await enterAppWithUser(parsed);
                return;
              }
            } catch {
              // fall through
            }
          }
          // Never enter the app with a null user id — calls/Ably require it.
          router.replace('/auth/login');
        };

        try {
          const response = await API.getWithAuth('mobile/profile', tokenStr);

          if (response?.data) {
            let userData = response.data;
            if (response.data.data) {
              userData = response.data.data;
            } else if (response.data.user) {
              userData = response.data.user;
            }
            await enterAppWithUser(userData);
            return;
          }

          await enterWithCacheOrStub();
        } catch {
          // Keep the stored session. Never wipe the token here —
          // only More → Log out signs the user out.
          await enterWithCacheOrStub();
        }
      } catch {
        const token = await getAuthToken().catch(() => null);
        if (token) {
          router.replace('/(tabs)/home');
          return;
        }
        router.replace('/auth/login');
      }
    };

    verifyAndLogin();
  }, []);

  return (
    <View className={`flex-1 items-center justify-center bg-light dark:bg-dark`}>
      <LogoIcon color={isDark ? '#fff' : '#000'} width={120} height={120} />
    </View>
  );
}
