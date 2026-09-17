import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '@/api';

/**
 * Remote push via expo-notifications was removed from Expo Go (Android) in SDK 53+.
 * Never import/require expo-notifications while running inside Expo Go.
 */
export function isPushNotificationsAvailable() {
  return Constants.appOwnership !== 'expo';
}

function loadNotifications() {
  if (!isPushNotificationsAvailable()) {
    return null;
  }
  // Lazy require so Expo Go never evaluates the native module at import time.
  // eslint-disable-next-line global-require
  return require('expo-notifications');
}

let notificationHandlerConfigured = false;

function ensureNotificationHandler(Notifications) {
  if (!Notifications || notificationHandlerConfigured) return;
  notificationHandlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions and get Expo push token.
 * Physical devices + development/production builds only (not Expo Go).
 */
export async function registerForPushNotificationsAsync() {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return null;
  }

  ensureNotificationHandler(Notifications);
  let token = null;

  if (!Device.isDevice) {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification! Permission denied.');
      return null;
    }

    const projectId =
      Constants.easConfig?.projectId ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      '0d0c0c8d-a116-439d-8892-5965ec3f1841';

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });

    token = tokenData.data;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Send Expo push token to backend
 */
export async function sendPushTokenToBackend(token, authToken) {
  if (!token || !authToken) {
    console.warn('Cannot send push token: missing token or auth token');
    return false;
  }

  try {
    const response = await API.post('mobile/push-token', {
      expo_push_token: token,
    }, authToken);

    return response?.data?.success === true;
  } catch (error) {
    if (__DEV__) {
      console.error('Error sending push token to backend:', error?.response?.data || error?.message);
    }
    return false;
  }
}

/**
 * Setup notification listeners (tap + cold start).
 * Navigation uses expo-router — no React Navigation ref required.
 *
 * Cold-start taps are stashed (not navigated immediately) so auth bootstrap
 * in loading.jsx can route after login instead of replacing to Home.
 */
let pendingColdStartNotification = null;
const HANDLED_NOTIFICATION_IDS_KEY = 'handled_push_notification_ids';

async function wasNotificationAlreadyHandled(notificationId) {
  if (!notificationId) return false;
  try {
    const raw = await AsyncStorage.getItem(HANDLED_NOTIFICATION_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) && ids.includes(notificationId);
  } catch {
    return false;
  }
}

async function markNotificationHandled(notificationId) {
  if (!notificationId) return;
  try {
    const raw = await AsyncStorage.getItem(HANDLED_NOTIFICATION_IDS_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(ids) ? ids.filter((id) => id !== notificationId) : [];
    next.push(notificationId);
    // Keep a small rolling window to avoid unbounded growth.
    await AsyncStorage.setItem(HANDLED_NOTIFICATION_IDS_KEY, JSON.stringify(next.slice(-40)));
  } catch {
    // ignore storage failures
  }
}

/**
 * Consume a cold-start notification payload (once). Returns data or null.
 * Also re-reads getLastNotificationResponseAsync so auth bootstrap is not
 * racing the listener setup stash.
 */
export async function consumePendingNotificationNavigation() {
  let pending = pendingColdStartNotification;
  pendingColdStartNotification = null;

  if (!pending?.data) {
    const Notifications = loadNotifications();
    if (Notifications?.getLastNotificationResponseAsync) {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        const notificationId = response?.notification?.request?.identifier;
        const data = response?.notification?.request?.content?.data;
        if (data && notificationId && !(await wasNotificationAlreadyHandled(notificationId))) {
          pending = { id: notificationId, data };
        }
      } catch {
        // ignore
      }
    }
  }

  if (!pending?.data) return null;
  if (pending.id) {
    await markNotificationHandled(pending.id);
  }
  return pending.data;
}

export function setupNotificationListeners() {
  const Notifications = loadNotifications();
  if (!Notifications) {
    return {
      notificationListener: null,
      responseListener: null,
    };
  }

  ensureNotificationHandler(Notifications);
  const notificationListener = Notifications.addNotificationReceivedListener(() => {});

  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    const notificationId = response?.notification?.request?.identifier;
    const data = response?.notification?.request?.content?.data;
    if (!data) return;
    markNotificationHandled(notificationId).finally(() => {
      handleNotificationNavigation(data);
    });
  });

  // App opened from a killed state via notification tap — stash for loading.jsx.
  Notifications.getLastNotificationResponseAsync?.()
    .then(async (response) => {
      const notificationId = response?.notification?.request?.identifier;
      const data = response?.notification?.request?.content?.data;
      if (!data || !notificationId) return;
      if (await wasNotificationAlreadyHandled(notificationId)) return;
      pendingColdStartNotification = { id: notificationId, data };
    })
    .catch(() => {});

  return {
    notificationListener,
    responseListener,
  };
}

/**
 * Handle navigation based on notification data
 */
export function handleNotificationNavigation(data) {
  if (!data) return;

  try {
    import('expo-router').then(({ router }) => {
      const {
        type,
        link,
        mobile_link,
        post_id,
        project_id,
        sender_id,
        follower_id,
        conversation_id,
        other_user_id,
        user_id,
        event_id,
      } = data;

      const targetLink = mobile_link || link;

      if (typeof targetLink === 'string' && targetLink.length > 0) {
        if (targetLink.startsWith('/events/')) {
          const id = targetLink.split('/')[2];
          if (id) {
            router.push(`/(tabs)/events/${id}`);
            return;
          }
        }
        if (targetLink.startsWith('/posts/')) {
          router.push(`/(tabs)${targetLink}`);
          return;
        }
        if (targetLink.startsWith('/profile/')) {
          const id = targetLink.split('/')[2];
          if (id) {
            router.push({ pathname: '/(tabs)/profile', params: { userId: String(id) } });
            return;
          }
        }
        if (targetLink.includes('reservations') || targetLink.startsWith('/admin/reservations')) {
          router.push('/(tabs)/reservations');
          return;
        }
        if (targetLink.includes('appointments') || targetLink.startsWith('/admin/appointments')) {
          router.push('/(tabs)/reservations');
          return;
        }
      }

      switch (type) {
        case 'post_interaction':
          if (post_id) {
            router.push(`/(tabs)/posts/${post_id}`);
          } else {
            router.push('/(tabs)/home');
          }
          break;

        case 'follow': {
          const profileId = follower_id || user_id || sender_id;
          if (profileId) {
            router.push({ pathname: '/(tabs)/profile', params: { userId: String(profileId) } });
          } else {
            router.push('/(tabs)/profile');
          }
          break;
        }

        case 'project_status':
        case 'project_submission':
        case 'task_assignment':
        case 'project_message':
          router.push('/(tabs)/projects-hub');
          break;

        case 'chat_message': {
          const peerId = other_user_id || sender_id;
          if (peerId) {
            router.push(`/(tabs)/chat/${peerId}`);
          } else {
            router.push('/(tabs)/chat');
          }
          break;
        }

        case 'reservation':
        case 'appointment':
        case 'access_request_response':
          router.push('/(tabs)/reservations');
          break;

        case 'exercise_review':
          router.push('/(tabs)/training');
          break;

        case 'discipline_change':
          router.push('/(tabs)/profile');
          break;

        case 'announcement':
          router.push('/(tabs)/notifications');
          break;

        case 'attendance_reminder':
          router.push('/(tabs)/training/check-in');
          break;

        case 'event':
          if (event_id) {
            router.push(`/(tabs)/events/${event_id}`);
          } else {
            router.push('/(tabs)/events');
          }
          break;

        default:
          router.push('/(tabs)/notifications');
          break;
      }
    });
  } catch (error) {
    console.error('Error handling notification navigation:', error);
  }
}

/**
 * Remove notification listeners
 */
export function removeNotificationListeners(listeners) {
  if (listeners?.notificationListener) {
    listeners.notificationListener.remove();
  }
  if (listeners?.responseListener) {
    listeners.responseListener.remove();
  }
}
