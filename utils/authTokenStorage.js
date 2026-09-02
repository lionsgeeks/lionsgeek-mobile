import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const AUTH_TOKEN_KEY = 'auth_token';

let secureStoreAvailable = null;

function normalizeToken(value) {
  if (typeof value !== 'string') return null;
  const token = value.trim();
  if (!token || token === 'false' || token === 'null' || token === 'undefined') {
    return null;
  }
  return token;
}

/**
 * SecureStore is unavailable on Expo web and throws if used there.
 * Native iOS/Android use the OS keychain/keystore.
 */
async function canUseSecureStore() {
  if (Platform.OS === 'web') {
    return false;
  }
  if (secureStoreAvailable !== null) {
    return secureStoreAvailable;
  }
  try {
    secureStoreAvailable = await SecureStore.isAvailableAsync();
  } catch {
    secureStoreAvailable = false;
  }
  return secureStoreAvailable;
}

async function readLegacyAsyncStorageToken() {
  return normalizeToken(await AsyncStorage.getItem(AUTH_TOKEN_KEY));
}

async function clearLegacyAsyncStorageToken() {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Returns the current Sanctum PAT.
 * On native, migrates a leftover AsyncStorage `auth_token` into SecureStore
 * on first read, then deletes the plaintext copy.
 * On web, SecureStore is not supported; AsyncStorage is the explicit fallback.
 */
export async function getAuthToken() {
  if (await canUseSecureStore()) {
    const stored = normalizeToken(await SecureStore.getItemAsync(AUTH_TOKEN_KEY));
    if (stored) {
      await clearLegacyAsyncStorageToken().catch(() => {});
      return stored;
    }

    const legacy = await readLegacyAsyncStorageToken();
    if (legacy) {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, legacy);
      await clearLegacyAsyncStorageToken();
      return legacy;
    }

    return null;
  }

  return readLegacyAsyncStorageToken();
}

export async function setAuthToken(token) {
  const value = normalizeToken(typeof token === 'string' ? token : String(token ?? ''));
  if (!value) {
    throw new Error('Invalid token');
  }

  if (await canUseSecureStore()) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, value);
    await clearLegacyAsyncStorageToken().catch(() => {});
    return;
  }

  await AsyncStorage.setItem(AUTH_TOKEN_KEY, value);
}

export async function removeAuthToken() {
  if (await canUseSecureStore()) {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => {});
  }
  await clearLegacyAsyncStorageToken().catch(() => {});
}
