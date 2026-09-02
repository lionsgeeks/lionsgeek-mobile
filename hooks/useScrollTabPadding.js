import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';

/** Bottom padding for ScrollView / FlatList so the last item clears the tab bar. */
export function useScrollTabPadding(extra = 16) {
  const tabBarHeight = useBottomTabOverflow();
  return tabBarHeight + extra;
}

/** @deprecated alias — same as useScrollTabPadding */
export function useScrollEndPadding(extra = 16) {
  return useScrollTabPadding(extra);
}
