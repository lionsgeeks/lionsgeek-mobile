import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { router } from 'expo-router';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { token } = useAppContext();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if token exists in storage (in case context hasn't loaded yet)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('auth_token');
        if (!storedToken && !token) {
          // No token in storage and no token in context - redirect to login
          router.replace('/auth/login');
        }
      } catch (error) {
        console.error('[TABS] Error checking auth:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    
    checkAuth();
  }, []);

  useEffect(() => {
    // Only redirect if we've finished checking and there's no token
    if (!isCheckingAuth && !token) {
      router.replace('/auth/login');
    }
  }, [token, isCheckingAuth]);


  const { user } = useAppContext();
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some(r => ['admin', 'coach'].includes(r?.toLowerCase?.() || r));
  const isStudent = userRoles.some(r => r?.toLowerCase?.() === 'student') || (!isAdmin && userRoles.length === 0);

  // Map SF Symbols icon names to Ionicons names for cross-platform support
  const getIconName = (sfSymbolName, focused = false) => {
    const iconMap = {
      "house.fill": focused ? "home" : "home-outline",
      "calendar": focused ? "calendar" : "calendar-outline",
      "chatbubbles.fill": focused ? "chatbubbles" : "chatbubbles-outline",
      "trophy.fill": focused ? "trophy" : "trophy-outline",
      "ellipsis": "ellipsis-horizontal",
      "person.3.fill": focused ? "people" : "people-outline",
      "hammer.fill": focused ? "hammer" : "hammer-outline",
      "person.fill": focused ? "person" : "person-outline",
      "magnifyingglass": focused ? "search" : "search-outline",
      "bell.fill": focused ? "notifications" : "notifications-outline",
    };
    return iconMap[sfSymbolName] || sfSymbolName;
  };

  const tabScreen = [
    { route: "index", name: "Home", icon: "house.fill", showTab: true, roles: [] }, // Everyone
    { route: "reservations", name: "Reservations", icon: "calendar", showTab: true, roles: [] }, // Everyone
    { route: "chat", name: "Chat", icon: "chatbubbles.fill", showTab: true, roles: [] }, // Everyone
    { route: "training", name: "Training", icon: "school", showTab: true, roles: [] }, // Everyone
    { route: "leaderboard", name: "Leaderboard", icon: "trophy.fill", showTab: true, roles: [] },
    { route: "more", name: "More", icon: "ellipsis", showTab: true, roles: [] }, // Everyone
  ].filter(screen => screen.showTab)
  
  const hiddenScreens = [
    // hado mo2a9atan hna
    { route: "members", name: "Members", icon: "person.3.fill", showTab: isAdmin, roles: ['admin', 'coach'] },
    { route: "projects", name: "Projects", icon: "hammer.fill", showTab: true, roles: [] }, // 
    // tal 7ad  hna
    { route: "home", name: "Home", icon: "house.fill", showTab: false }, // Hide duplicate home tab
    { route: "profile", name: "Profile", icon: "person.fill", showTab: false },
    { route: "search", name: "Search", icon: "magnifyingglass", showTab: false },
    { route: "notifications", name: "Notifications", icon: "bell.fill", showTab: false },
  ]


  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.alpha,
        tabBarInactiveTintColor: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: isDark ? Colors.dark : Colors.light,
            borderTopColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
            borderTopWidth: 1,
          },
          default: {
            backgroundColor: isDark ? Colors.dark : Colors.light,
            borderTopColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
            borderTopWidth: 1,
          },
        }),
      }}>


      {/* screen inside the navigation bar */}
      {tabScreen.map((screen, idx) => (
        <Tabs.Screen
          key={idx}
          name={screen.route}
          options={{
            headerShown: false,
            title: screen.name,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                size={28} 
                name={getIconName(screen.icon, focused)} 
                color={color}
              />
            ),
            tabBarStyle: screen.showTab ? undefined : { display: 'none' },
          }}
        />
      ))}



      {/* screen hidden from nav tab */}
      {hiddenScreens.map((screen, idx) => (
        <Tabs.Screen
          key={idx}
          name={screen.route}
          options={{
            headerShown: false,
            title: screen.name,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                size={28} 
                name={getIconName(screen.icon, focused)} 
                color={color}
              />
            ),
            tabBarStyle: screen.showTab ? undefined : { display: 'none' },
            href: null,
          }}
        />
      ))}

    </Tabs>
  );
}
