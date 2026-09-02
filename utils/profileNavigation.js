import { router } from 'expo-router';

/** Opens the Profile tab for the signed-in user (clears stale userId params). */
export function goToOwnProfileTab() {
  router.replace({
    pathname: '/(tabs)/profile',
    params: { userId: undefined, id: undefined },
  });
}
