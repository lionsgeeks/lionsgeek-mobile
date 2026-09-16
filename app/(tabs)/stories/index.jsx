import { Redirect } from 'expo-router';

/**
 * Stories has no real index UI — create/viewer/archive are pushed on top.
 * If this tab is ever focused alone (e.g. after closing create), bounce to home.
 */
export default function StoriesIndex() {
  return <Redirect href="/(tabs)/home" />;
}
