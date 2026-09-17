/**
 * Native incoming-call UI via CallKeep:
 * - iOS: CallKit (system call screen + ringtone)
 * - Android: ConnectionService / Telecom UI
 *
 * Requires a development/production build (not Expo Go).
 * After installing, rebuild: eas build --profile development
 */

import { Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

let RNCallKeep = null;
try {
  if (!isExpoGo) {
    // eslint-disable-next-line global-require
    RNCallKeep = require('react-native-callkeep').default;
  }
} catch (e) {
  if (__DEV__) {
    console.warn('[CallKeep] native module unavailable:', e?.message);
  }
}

const APP_NAME = 'LionsGeek';

/** @type {Map<string, { callId: number|string, callerName: string, callType: string, uuid: string }>} */
const uuidByCallId = new Map();
/** @type {Map<string, { callId: number|string, callerName: string, callType: string, uuid: string }>} */
const callByUuid = new Map();

let setupPromise = null;
let listenersBound = false;

function makeUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isCallKeepAvailable() {
  return !!RNCallKeep && !isExpoGo;
}

function rememberIncoming({ callId, callerName, callType, uuid }) {
  const key = String(callId);
  const entry = { callId, callerName, callType, uuid };
  uuidByCallId.set(key, entry);
  callByUuid.set(uuid, entry);
  return entry;
}

/** Used when native PushKit already reported CallKit with a fixed UUID. */
export function rememberIncomingFromVoip({ callId, callerName, callType, uuid }) {
  return rememberIncoming({ callId, callerName, callType, uuid });
}

export function getCallKeepUuidForCallId(callId) {
  return uuidByCallId.get(String(callId))?.uuid || null;
}

export function getCallMetaForUuid(uuid) {
  return callByUuid.get(uuid) || null;
}

export function clearCallKeepMapping(callIdOrUuid) {
  const asCall = uuidByCallId.get(String(callIdOrUuid));
  if (asCall) {
    uuidByCallId.delete(String(asCall.callId));
    callByUuid.delete(asCall.uuid);
    return;
  }
  const asUuid = callByUuid.get(String(callIdOrUuid));
  if (asUuid) {
    uuidByCallId.delete(String(asUuid.callId));
    callByUuid.delete(asUuid.uuid);
  }
}

async function ensureAndroidPermissions() {
  if (Platform.OS !== 'android') return true;
  try {
    const needed = [
      PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS,
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ].filter(Boolean);

    const result = await PermissionsAndroid.requestMultiple(needed);
    return Object.values(result).every(
      (status) => status === PermissionsAndroid.RESULTS.GRANTED || status === 'granted'
    );
  } catch {
    return false;
  }
}

/**
 * Setup CallKeep once per process. Safe to call repeatedly.
 */
export async function setupCallKeep() {
  if (!isCallKeepAvailable()) return false;
  if (setupPromise) return setupPromise;

  setupPromise = (async () => {
    try {
      await ensureAndroidPermissions();

      const options = {
        ios: {
          appName: APP_NAME,
          supportsVideo: true,
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
        },
        android: {
          alertTitle: 'Phone account permission',
          alertDescription: 'LionsGeek needs access to your phone account to show incoming calls.',
          cancelButton: 'Cancel',
          okButton: 'OK',
          additionalPermissions: [],
          foregroundService: {
            channelId: 'incoming-calls',
            channelName: 'Incoming voice calls',
            notificationTitle: 'LionsGeek call',
            notificationIcon: 'ic_launcher',
          },
          selfManaged: false,
        },
      };

      await RNCallKeep.setup(options);
      RNCallKeep.setAvailable(true);

      if (Platform.OS === 'android') {
        try {
          RNCallKeep.registerPhoneAccount(options);
          RNCallKeep.registerAndroidEvents();
          RNCallKeep.setAvailable(true);
        } catch (e) {
          if (__DEV__) console.warn('[CallKeep] Android register:', e?.message);
        }
      }

      return true;
    } catch (e) {
      if (__DEV__) console.warn('[CallKeep] setup failed:', e?.message);
      setupPromise = null;
      return false;
    }
  })();

  return setupPromise;
}

/**
 * Show the native incoming-call UI and start system ringing.
 */
export async function displayNativeIncomingCall({
  callId,
  callerName = 'LionsGeek user',
  callType = 'audio',
  handle = null,
}) {
  if (!callId) return null;
  const ok = await setupCallKeep();
  if (!ok || !RNCallKeep) return null;

  const existing = uuidByCallId.get(String(callId));
  if (existing?.uuid) {
    return existing.uuid;
  }

  const uuid = makeUuid().toLowerCase();
  const number = handle || String(callId);
  const hasVideo = callType === 'video';

  rememberIncoming({ callId, callerName, callType, uuid });

  try {
    RNCallKeep.displayIncomingCall(uuid, number, callerName, 'generic', hasVideo);
    return uuid;
  } catch (e) {
    clearCallKeepMapping(callId);
    if (__DEV__) console.warn('[CallKeep] displayIncomingCall failed:', e?.message);
    return null;
  }
}

export async function endNativeCallForCallId(callId) {
  const uuid = getCallKeepUuidForCallId(callId);
  if (!uuid || !RNCallKeep) return;
  try {
    RNCallKeep.endCall(uuid);
  } catch (_) {}
  clearCallKeepMapping(callId);
}

export async function endAllNativeCalls() {
  if (!RNCallKeep) return;
  try {
    RNCallKeep.endAllCalls();
  } catch (_) {}
  uuidByCallId.clear();
  callByUuid.clear();
}

/**
 * Bind answer / end listeners. Returns cleanup.
 * Handlers receive { callId, uuid, callType, callerName }.
 */
export function bindCallKeepListeners({ onAnswer, onEnd }) {
  if (!isCallKeepAvailable() || listenersBound) {
    return () => {};
  }
  listenersBound = true;

  const answerSub = RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
    const meta = getCallMetaForUuid(callUUID);
    if (!meta) return;
    onAnswer?.(meta);
  });

  const endSub = RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
    const meta = getCallMetaForUuid(callUUID);
    clearCallKeepMapping(callUUID);
    if (!meta) return;
    onEnd?.(meta);
  });

  return () => {
    listenersBound = false;
    try {
      answerSub?.remove?.();
      endSub?.remove?.();
    } catch (_) {
      try {
        RNCallKeep.removeEventListener('answerCall');
        RNCallKeep.removeEventListener('endCall');
      } catch (_) {}
    }
  };
}
