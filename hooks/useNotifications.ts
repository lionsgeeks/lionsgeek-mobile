import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useEffect, useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';

type UseNotificationsReturn = {
  expoPushToken: string | null;
  lastNotification: Notifications.Notification | null;
  scheduleLocalNotification: (title?: string, body?: string) => Promise<void>;
};

export default function useNotifications(): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    // Move setNotificationHandler here to avoid bundler/native errors
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        // Newer SDKs expect these flags as well (iOS presentation styles)
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      setLastNotification(notification);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  const scheduleLocalNotification = useCallback(
    async (title = 'Hello', body = 'This is a test') => {
      const trigger: Notifications.TimeIntervalTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        repeats: false,
      };
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger,
      });
    },
    []
  );

  return { expoPushToken, lastNotification, scheduleLocalNotification };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

  // Android requires a channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Permission required', 'Failed to get push token for notifications.');
    return null;
  }

  try {
    // In dev clients / standalone builds, passing projectId is required
    const projectId =
      // Preferred in production/EAS
      (Constants as any).easConfig?.projectId ??
      // Fallback for Expo Go/dev
      (Constants as any).expoConfig?.extra?.eas?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenData.data;
    if (__DEV__) {
      console.log('Expo Push Token registered:', !!token);
    }
    return token;
  } catch (err) {
    if (__DEV__) {
      console.error('Error getting push token:', err);
    }
    return null;
  }
}

// Notification handler should be configured once. Keeping it within the hook's effect ensures
// it's set during app lifecycle, and avoids multiple registrations across environments.
