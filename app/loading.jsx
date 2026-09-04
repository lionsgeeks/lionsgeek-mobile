import { useEffect } from 'react';

import { View } from 'react-native';

import { useAppContext } from '@/context';

import { router } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken, removeAuthToken } from '@/utils/authTokenStorage';

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

          await removeAuthToken();
          await AsyncStorage.removeItem('auth_user');

          router.replace('/auth/login');

          return;

        }



        try {

          const response = await API.getWithAuth('mobile/profile', tokenStr);



          if (response?.data) {

            let userData = response.data;

            if (response.data.data) {

              userData = response.data.data;

            } else if (response.data.user) {

              userData = response.data.user;

            }



            await saveAuth(tokenStr, userData);



            try {

              const pushToken = await registerForPushNotificationsAsync();

              if (pushToken) {

                await sendPushTokenToBackend(pushToken, tokenStr);

              }

            } catch {

              // Push setup is optional; do not block app flow.

            }



            router.replace('/(tabs)/home');

          } else {

            await removeAuthToken();
          await AsyncStorage.removeItem('auth_user');

            router.replace('/auth/login');

          }

        } catch {

          await removeAuthToken();
          await AsyncStorage.removeItem('auth_user');

          router.replace('/auth/login');

        }

      } catch {

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


