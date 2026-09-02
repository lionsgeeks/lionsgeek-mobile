import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Navbar from './Navbar';

/**
 * Reusable App Layout component for consistent structure.
 * When the navbar is hidden, applies safe-area top padding so content clears the status bar.
 * Tab-bar bottom inset belongs on ScrollView/FlatList contentContainerStyle (useScrollTabPadding).
 */
export default function AppLayout({
  children,
  showNavbar = true,
  skipTopInset = false,
  className = '',
}) {
  const insets = useSafeAreaInsets();
  const applyTopInset = !showNavbar && !skipTopInset;

  return (
    <View className={`flex-1 bg-light dark:bg-dark ${className}`}>
      {showNavbar && <Navbar />}
      <View
        className="flex-1"
        style={applyTopInset ? { paddingTop: insets.top + 4 } : undefined}
      >
        {children}
      </View>
    </View>
  );
}
