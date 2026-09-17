import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useEffect, useState, useCallback } from 'react';
import { Platform, Alert } from 'react-native';

type NotificationLike = {
  request?: unknown;
};

type UseNotificationsReturn = {
  expoPushToken: string | null;
  lastNotification: NotificationLike | null;
  scheduleLocalNotification: (title?: string, body?: string) => Promise<void>;
};

function isExpoGo() {
  return Constants.appOwnership === 'expo';
}

function loadNotifications(): typeof import('expo-notifications') | null {
  if (isExpoGo()) return null;
  // Lazy require so Expo Go never evaluates the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications');
}

export default function useNotifications(): UseNotificationsReturn {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [lastNotification, setLastNotification] = useState<NotificationLike | null>(null);

  useEffect(() => {
    const Notifications = loadNotifications();
    if (!Notifications) {
      return undefined;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    registerForPushNotificationsAsync(Notifications).then(token => setExpoPushToken(token));

    const receivedSub = Notifications.addNotificationReceivedListener(notification => {
      setLastNotification(notification);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      if (__DEV__) console.log('Notification response received');
      setLastNotification(response?.notification ?? null);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  const scheduleLocalNotification = useCallback(
    async (title = 'Hello', body = 'This is a test') => {
      const Notifications = loadNotifications();
      if (!Notifications) return;

      const trigger = {
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

async function registerForPushNotificationsAsync(
  Notifications: typeof import('expo-notifications'),
): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

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
    const projectId =
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
      (Constants as { expoConfig?: { extra?: { eas?: { projectId?: string } } } }).expoConfig?.extra?.eas
        ?.projectId;

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
