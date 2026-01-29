import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import API from '@/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions and get Expo push token
 * This should only be called on a physical device
 */
export async function registerForPushNotificationsAsync() {
  let token = null;

  // Check if running on a physical device
  if (!Device.isDevice) {
    console.warn('Push notifications only work on physical devices, not simulators');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification! Permission denied.');
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '0d0c0c8d-a116-439d-8892-5965ec3f1841', // From app.json extra.eas.projectId
    });

    token = tokenData.data;
    console.log('✅ Expo push token obtained:', token.substring(0, 20) + '...');
    console.log('📱 Full token (for debugging):', token);

    // Configure Android channel
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
    console.log('📤 Sending push token to backend...');
    const response = await API.post('mobile/push-token', {
      expo_push_token: token,
    }, authToken);

    console.log('📥 Backend response:', JSON.stringify(response?.data, null, 2));

    if (response?.data?.success) {
      console.log('✅ Push token sent to backend successfully');
      return true;
    } else {
      console.warn('⚠️ Backend did not confirm push token save:', response?.data);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending push token to backend:', error);
    console.error('Error details:', error?.response?.data || error?.message);
    return false;
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(navigation) {
  // Listener for notifications received while app is foregrounded
  const notificationListener = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received (foreground):', notification);
    // You can handle foreground notifications here
    // For example, show an in-app notification
  });

  // Listener for when user taps on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
    const data = response.notification.request.content.data;
    
    // Navigate based on notification data
    if (data && navigation) {
      handleNotificationNavigation(data, navigation);
    }
  });

  return {
    notificationListener,
    responseListener,
  };
}

/**
 * Handle navigation based on notification data
 */
function handleNotificationNavigation(data) {
  if (!data) return;

  try {
    // Dynamic import to avoid circular dependencies
    import('expo-router').then(({ router }) => {
      const { type, link, post_id, project_id, sender_id, follower_id } = data;

      // Navigate based on notification type
      switch (type) {
        case 'post_interaction':
          if (post_id) {
            router.push('/(tabs)');
            // You might want to scroll to the specific post
          }
          break;
        
        case 'follow':
          if (follower_id) {
            router.push(`/(tabs)/profile`);
          }
          break;
        
        case 'project_status':
        case 'project_submission':
          if (project_id) {
            router.push('/(tabs)/reservations');
          }
          break;
        
        case 'task_assignment':
          router.push('/(tabs)/reservations');
          break;
        
        case 'project_message':
          if (project_id) {
            router.push('/(tabs)/reservations');
          }
          break;
        
        case 'chat_message':
          if (conversation_id) {
            router.push('/(tabs)/chat');
          }
          break;
        
        case 'reservation':
          router.push('/(tabs)/reservations');
          break;
        
        case 'appointment':
          router.push('/(tabs)/reservations');
          break;
        
        case 'access_request_response':
          router.push('/(tabs)/reservations');
          break;
        
        case 'exercise_review':
          router.push('/(tabs)/reservations');
          break;
        
        case 'discipline_change':
          router.push('/(tabs)/profile');
          break;
        
        default:
          // Default navigation
          if (link) {
            // Handle link-based navigation if needed
            console.log('Notification link:', link);
          }
          router.push('/(tabs)');
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
    Notifications.removeNotificationSubscription(listeners.notificationListener);
  }
  if (listeners?.responseListener) {
    Notifications.removeNotificationSubscription(listeners.responseListener);
  }
}
