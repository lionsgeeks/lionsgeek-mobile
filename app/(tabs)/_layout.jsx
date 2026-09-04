import { Tabs, router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as SystemUI from 'expo-system-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar } from '@react-navigation/bottom-tabs';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';
import { goToOwnProfileTab } from '@/utils/profileNavigation';
import { getAuthToken } from '@/utils/authTokenStorage';

function ProfileTabBarButton(props) {
  return (
    <HapticTab
      {...props}
      onPress={() => {
        goToOwnProfileTab();
      }}
      delayLongPress={400}
      onLongPress={() => {
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        }
        router.push('/(tabs)/more');
      }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { token } = useAppContext();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [storedToken, setStoredToken] = useState(null);

  // Check if token exists in storage (in case context hasn't loaded yet)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const nextStoredToken = await getAuthToken();
        setStoredToken(nextStoredToken);

        if (!nextStoredToken && !token) {
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
  }, [token]);

  useEffect(() => {
    // Only redirect if we've finished checking and there's no token
    if (!isCheckingAuth && !token && !storedToken) {
      router.replace('/auth/login');
    }
  }, [token, storedToken, isCheckingAuth]);


  const { user } = useAppContext();
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some(r => ['admin', 'coach'].includes(r?.toLowerCase?.() || r));

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
      "qr-code": focused ? "qr-code" : "qr-code-outline",
      "ticket": focused ? "ticket" : "ticket-outline",
      "school": focused ? "school" : "school-outline",
    };
    return iconMap[sfSymbolName] || sfSymbolName;
  };

  const tabScreen = [
    { route: 'home', name: 'Home', label: 'Home', icon: 'house.fill' },
    { route: 'reservations', name: 'Reservations', label: 'Reservations', icon: 'calendar' },
    { route: 'events', name: 'Events', label: 'Events', icon: 'ticket' },
    { route: 'profile', name: 'Profile', label: 'Profile', icon: 'person.fill' },
    // { route: 'leaderboard', name: 'Leaderboard', label: 'Rank', icon: 'trophy.fill' },
  ];

  const hiddenScreens = [
    { route: "members", name: "Members", icon: "person.3.fill", showTab: isAdmin, roles: ['admin', 'coach'] },
    { route: "training", name: "Training", icon: "school" },
    { route: "search", name: "Search", icon: "magnifyingglass", showTab: false },
    { route: "notifications", name: "Notifications", icon: "bell.fill", showTab: false },
    { route: "infoSession", name: "Info Session", icon: "school", showTab: false },
    // Stack screens (non-tab routes living under (tabs)/)
    { route: "chat", name: "Chat", icon: "chatbubbles.fill", showTab: false },
    { route: "stories", name: "Stories", icon: "book", showTab: false },
    { route: "posts", name: "Posts", icon: "document-text", showTab: false },
    { route: "settings", name: "Settings", icon: "settings", showTab: false },
    { route: "more", name: "More", icon: "ellipsis", showTab: false, hideTabBar: false },
    { route: "activity", name: "Activity", icon: "pulse", showTab: false },
    { route: "saved-posts", name: "Saved posts", icon: "bookmark", showTab: false },
    { route: "achievements", name: "Achievements", icon: "trophy", showTab: false },
    { route: "learning-progress", name: "Learning", icon: "school", showTab: false },
    { route: "projects-hub", name: "Projects hub", icon: "hammer", showTab: false },
    { route: "admin-reports", name: "Reports", icon: "analytics", showTab: false },
    { route: "customization", name: "Customize", icon: "color-palette", showTab: false },
    { route: "attendance-history", name: "Attendance", icon: "calendar", showTab: false },
    { route: "reservation-history-studio", name: "Studio history", icon: "calendar", showTab: false },
    { route: "reservation-history-cowork", name: "Cowork history", icon: "calendar", showTab: false },
    { route: "notification-preferences", name: "Notification prefs", icon: "notifications", showTab: false },
    { route: "terms", name: "Terms", icon: "document-text", showTab: false },
    { route: "privacy", name: "Privacy", icon: "shield", showTab: false },
    { route: "support", name: "Support", icon: "help-circle", showTab: false },
    { route: "licenses", name: "Licenses", icon: "document", showTab: false },
    { route: "call", name: "Call", icon: "call", showTab: false },
    { route: "incoming-call", name: "Incoming call", icon: "call", showTab: false },
    { route: "outgoing-call", name: "Outgoing call", icon: "call", showTab: false },
  ]


  const isDark = colorScheme === 'dark';
  const activeRingColor = Colors.alpha;
  const tabBarBg = isDark ? Colors.dark : Colors.light;

  const visibleTabOrder = useMemo(() => tabScreen.map((s) => s.route), [tabScreen]);

  const tabBarStyle = useMemo(() => {
    const contentHeight = Platform.OS === 'ios' ? 49 : 64;
    const base = {
      backgroundColor: tabBarBg,
      borderTopColor: isDark ? Colors.dark_gray : Colors.dark_gray + '30',
      borderTopWidth: 1,
      paddingBottom: insets.bottom,
      height: contentHeight + insets.bottom,
    };
    return Platform.OS === 'ios'
      ? { ...base, position: 'absolute', left: 0, right: 0, bottom: 0 }
      : base;
  }, [insets.bottom, isDark, tabBarBg]);

  useEffect(() => {
    if (Platform.OS === 'android') {
      SystemUI.setBackgroundColorAsync(tabBarBg).catch(() => {});
    }
  }, [tabBarBg]);

  const lastVisibleTabIndexRef = useRef(0);

  const renderTabBar = useCallback((props) => {
    const filteredRoutes = visibleTabOrder
      .map((name) => props.state.routes.find((route) => route.name === name))
      .filter(Boolean);
    const activeRouteName = props.state.routes[props.state.index]?.name;
    const filteredIndex = filteredRoutes.findIndex((route) => route.name === activeRouteName);
    const onHiddenRoute = filteredIndex < 0;

    if (filteredIndex >= 0) {
      lastVisibleTabIndexRef.current = filteredIndex;
    }

    const filteredDescriptors = Object.fromEntries(
      filteredRoutes.map((route) => {
        const descriptor = props.descriptors[route.key];
        if (!descriptor) return [route.key, descriptor];

        const OriginalButton = descriptor.options.tabBarButton ?? HapticTab;

        return [
          route.key,
          {
            ...descriptor,
            options: {
              ...descriptor.options,
              tabBarIcon: descriptor.options.tabBarIcon
                ? (iconProps) =>
                    descriptor.options.tabBarIcon({
                      ...iconProps,
                      focused: onHiddenRoute ? false : iconProps.focused,
                    })
                : descriptor.options.tabBarIcon,
              tabBarButton: (buttonProps) => (
                <OriginalButton
                  {...buttonProps}
                  onPress={(e) => {
                    if (route.name === 'profile') {
                      goToOwnProfileTab();
                      return;
                    }
                    if (onHiddenRoute) {
                      const event = props.navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                      });
                      if (!event.defaultPrevented) {
                        props.navigation.navigate(route.name, route.params);
                      }
                      return;
                    }
                    buttonProps.onPress?.(e);
                  }}
                />
              ),
            },
          },
        ];
      }),
    );

    const filteredState = {
      ...props.state,
      routes: filteredRoutes,
      index: filteredIndex >= 0 ? filteredIndex : lastVisibleTabIndexRef.current,
    };

    return (
      <BottomTabBar
        {...props}
        state={filteredState}
        descriptors={filteredDescriptors}
        activeTintColor={onHiddenRoute ? props.inactiveTintColor : props.activeTintColor}
      />
    );
  }, [visibleTabOrder]);

  return (
    <Tabs
      initialRouteName="home"
      tabBar={renderTabBar}
      screenOptions={{
        tabBarActiveTintColor: Colors.alpha,
        tabBarInactiveTintColor: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
        headerShown: false,
        tabBarShowLabel: true,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        // tabBarItemStyle: { flex: 1, minWidth: 0, maxWidth: '20%' },
        tabBarLabelStyle: {
          fontSize: 10,
          marginTop: 2,
        },
        tabBarStyle,
      }}>


      {/* screen inside the navigation bar */}
      {tabScreen.map((screen) => (
        <Tabs.Screen
          key={screen.route}
          name={screen.route}
          options={{
            headerShown: false,
            title: screen.name,
            tabBarLabel: screen.label,
            ...(screen.route === 'profile'
              ? {
                tabBarButton: ProfileTabBarButton,
              }
              : {}),
            tabBarIcon: ({ color, focused }) => {
              if (screen.route === 'profile') {
                const avatarUrl = user?.image
                  ? `${API.APP_URL}/storage/img/profile/${user.image}`
                  : null;
                const ringClassName = focused ? 'border-2' : 'border';
                const ringStyle = { borderColor: focused ? activeRingColor : 'transparent' };

                return (
                  <View className={`w-7 h-7 rounded-full overflow-hidden ${ringClassName}`} style={ringStyle}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} className="w-full h-full" />
                    ) : (
                      <View className="w-full h-full items-center justify-center bg-alpha/20">
                        <Ionicons size={16} name={focused ? 'person' : 'person-outline'} color={color} />
                      </View>
                    )}
                  </View>
                );
              }

              return (
                <Ionicons
                  size={24}
                  name={getIconName(screen.icon, focused)}
                  color={color}
                />
              );
            },
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
            tabBarStyle: screen.hideTabBar === false
              ? undefined
              : screen.showTab
                ? undefined
                : { display: 'none' },
            href: null,
          }}
        />
      ))}

    </Tabs>
  );
}
