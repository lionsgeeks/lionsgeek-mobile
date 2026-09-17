/**
 * iOS PushKit VoIP token registration.
 * Pairs with CallKeep: native AppDelegate reports CallKit on VoIP push (cold start).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import API from '@/api';
import {
  rememberIncomingFromVoip,
} from '@/services/callKeep';

const isExpoGo = Constants.appOwnership === 'expo';

let VoipPushNotification = null;
try {
  if (!isExpoGo && Platform.OS === 'ios') {
    // eslint-disable-next-line global-require
    VoipPushNotification = require('react-native-voip-push-notification').default;
  }
} catch (e) {
  if (__DEV__) {
    console.warn('[VoIP] module unavailable:', e?.message);
  }
}

let started = false;

export function isVoipPushAvailable() {
  return Platform.OS === 'ios' && !!VoipPushNotification && !isExpoGo;
}

/**
 * Register for PushKit + listen for token / early events.
 * @param {(token: string) => void|Promise<void>} onToken
 */
export function startVoipPushRegistration(onToken) {
  if (!isVoipPushAvailable() || started) {
    return () => {};
  }
  started = true;

  const onRegister = (voipToken) => {
    if (!voipToken) return;
    Promise.resolve(onToken?.(String(voipToken))).catch((e) => {
      console.warn('[VoIP] failed to upload token', e?.message);
    });
  };

  const onNotification = (notification) => {
    try {
      const callId = notification?.call_id || notification?.data?.call_id;
      const uuid = notification?.uuid;
      const callerName =
        notification?.callerName ||
        notification?.caller_name ||
        'LionsGeek user';
      const callType =
        notification?.call_type || notification?.callType || 'audio';
      if (callId && uuid) {
        rememberIncomingFromVoip({ callId, callerName, callType, uuid });
      }
      if (uuid && VoipPushNotification?.onVoipNotificationCompleted) {
        VoipPushNotification.onVoipNotificationCompleted(uuid);
      }
    } catch (e) {
      if (__DEV__) console.warn('[VoIP] notification handler', e?.message);
    }
  };

  const onDidLoad = (events) => {
    if (!Array.isArray(events)) return;
    for (const evt of events) {
      const name = evt?.name;
      const data = evt?.data;
      if (name === 'RNVoipPushRemoteNotificationsRegisteredEvent') {
        onRegister(data);
      } else if (name === 'RNVoipPushRemoteNotificationReceivedEvent') {
        onNotification(data);
      }
    }
  };

  VoipPushNotification.addEventListener('register', onRegister);
  VoipPushNotification.addEventListener('notification', onNotification);
  VoipPushNotification.addEventListener('didLoadWithEvents', onDidLoad);
  VoipPushNotification.registerVoipToken();

  return () => {
    started = false;
    try {
      VoipPushNotification.removeEventListener('register');
      VoipPushNotification.removeEventListener('notification');
      VoipPushNotification.removeEventListener('didLoadWithEvents');
    } catch (_) {}
  };
}

export async function sendVoipTokenToBackend(voipToken, authToken) {
  if (!voipToken || !authToken) return false;
  try {
    const response = await API.post(
      'mobile/push-token',
      { apns_voip_token: voipToken },
      authToken
    );
    return response?.data?.success === true;
  } catch (e) {
    if (__DEV__) {
      console.warn('[VoIP] upload failed', e?.response?.data || e?.message);
    }
    return false;
  }
}
