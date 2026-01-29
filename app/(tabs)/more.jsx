import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAppContext } from '@/context';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import Rolegard from '@/components/Rolegard';

export default function More() {
  const { user, token, signOut } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token) return;
      
      try {
        const response = await API.getWithAuth('mobile/profile', token);
        if (response?.data) {
          setProfile(response.data);
        } else {
          setProfile(user);
        }
      } catch (error) {
        console.error('[PROFILE] Error:', error);
        setProfile(user);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    } else {
      setProfile(user);
      setLoading(false);
    }
  }, [token, user]);

  const logout = async () => {
    await signOut();
    router.replace('/auth/login');
  };

  // Check if user is admin
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some(r => ['admin', 'coach'].includes(r?.toLowerCase?.() || r));

  const menuItems = [
    {
      label: 'Scan QR Code',
      icon: 'qr-code-outline',
      onPress: () => router.push('/(tabs)/training/qr-scanner'),
    },
    ...(isAdmin ? [
      {
        label: 'View All Members',
        icon: 'people-outline',
        onPress: () => router.push('/(tabs)/members'),
      },
    ] : []),
  ];

  const getImageUrl = () => {
    if (profile?.avatar) return profile.avatar;
    if (profile?.image) {
      if (profile.image.startsWith('http')) {
        return profile.image;
      }
      return `${API.APP_URL}/storage/img/profile/${profile.image}`;
    }
    return null;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const displayProfile = profile || user;
  const imageUrl = getImageUrl();
  const initials = getInitials(displayProfile?.name || displayProfile?.username);

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        <ScrollView 
          className="flex-1" 
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View className="bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 pt-12 pb-6 px-6">
            <Text className="text-2xl font-bold text-black dark:text-white mb-6">More</Text>
            
            {/* Profile Card - Enhanced */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.7}
            >
              <View className="bg-light dark:bg-dark rounded-2xl p-5 border border-light/20 dark:border-dark/20 shadow-sm">
                {loading ? (
                  <View className="flex-row items-center justify-center py-8">
                    <ActivityIndicator size="small" color={isDark ? '#fff' : '#000'} />
                    <Text className="text-sm text-black/60 dark:text-white/60 ml-3">Loading profile...</Text>
                  </View>
                ) : (
                  <View>
                    {/* Profile Header */}
                    <View className="flex-row items-center mb-4">
                      {/* Avatar */}
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          className="w-20 h-20 rounded-full mr-4 border-2 border-alpha/30"
                          defaultSource={require('@/assets/images/icon.png')}
                        />
                      ) : (
                        <View className="w-20 h-20 rounded-full mr-4 bg-alpha/20 dark:bg-alpha/40 items-center justify-center border-2 border-alpha/30">
                          <Text className="text-2xl font-bold text-alpha">
                            {initials}
                          </Text>
                        </View>
                      )}
                      
                      {/* User Info */}
                      <View className="flex-1">
                        <Text className="text-xl font-bold text-black dark:text-white mb-1">
                          {displayProfile?.name || displayProfile?.username || 'User'}
                        </Text>
                        {displayProfile?.email && (
                          <Text className="text-sm text-black/60 dark:text-white/60 mb-2">
                            {displayProfile.email}
                          </Text>
                        )}
                        {displayProfile?.roles && displayProfile.roles.length > 0 && (
                          <View className="flex-row items-center flex-wrap mt-1">
                            {displayProfile.roles.map((role, idx) => (
                              <View key={idx} className="px-2 py-0.5 rounded-full bg-alpha/20 mr-1 mb-1">
                                <Text className="text-xs font-medium text-alpha capitalize">
                                  {role}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      
                      {/* View Profile Indicator */}
                      <Ionicons 
                        name="chevron-forward" 
                        size={20} 
                        color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                      />
                    </View>

                    {/* Profile Details */}
                    <View className="pt-4 border-t border-light/20 dark:border-dark/20">
                      {/* Status */}
                      {displayProfile?.status && (
                        <View className="flex-row items-center mb-3">
                          <Ionicons 
                            name="briefcase-outline" 
                            size={18} 
                            color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                          />
                          <Text className="text-sm text-black/80 dark:text-white/80 ml-3 flex-1">
                            {displayProfile.status}
                          </Text>
                        </View>
                      )}
                      
                      {/* Promo */}
                      {displayProfile?.promo && (
                        <View className="flex-row items-center mb-3">
                          <Ionicons 
                            name="school-outline" 
                            size={18} 
                            color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                          />
                          <Text className="text-sm text-black/80 dark:text-white/80 ml-3 flex-1">
                            Promo: {displayProfile.promo}
                          </Text>
                        </View>
                      )}
                      
                      {/* Joined Date */}
                      {displayProfile?.created_at && (
                        <View className="flex-row items-center mb-3">
                          <Ionicons 
                            name="calendar-outline" 
                            size={18} 
                            color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                          />
                          <Text className="text-sm text-black/80 dark:text-white/80 ml-3 flex-1">
                            Joined {new Date(displayProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </Text>
                        </View>
                      )}

                      {/* Last Online */}
                      {displayProfile?.last_online && (() => {
                        const lastOnlineDate = new Date(displayProfile.last_online);
                        const now = new Date();
                        const diffMinutes = Math.floor((now - lastOnlineDate) / (1000 * 60));
                        const diffHours = Math.floor(diffMinutes / 60);
                        const diffDays = Math.floor(diffHours / 24);
                        const isOnline = diffMinutes <= 5;
                        
                        return (
                          <View className="flex-row items-center">
                            <Ionicons 
                              name="time-outline" 
                              size={18} 
                              color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                            />
                            <View className="flex-row items-center ml-3 flex-1">
                              {isOnline ? (
                                <>
                                  <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                                  <Text className="text-sm text-black/80 dark:text-white/80">
                                    Online
                                  </Text>
                                </>
                              ) : (
                                <Text className="text-sm text-black/80 dark:text-white/80">
                                  {diffDays > 0 ? (
                                    `Last seen ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
                                  ) : diffHours > 0 ? (
                                    `Last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
                                  ) : (
                                    `Last seen ${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`
                                  )}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })()}

                      {/* Admin Details - Only for admins viewing their own profile */}
                      <Rolegard authorized={['admin', 'coach']}>
                        {(displayProfile?.phone || displayProfile?.cin || displayProfile?.formation_id) && (
                          <View className="pt-3 mt-3 border-t border-light/20 dark:border-dark/20">
                            <Text className="text-xs font-semibold text-black/50 dark:text-white/50 mb-2 uppercase">
                              Admin Details
                            </Text>
                            {displayProfile?.phone && (
                              <View className="flex-row items-center mb-2">
                                <Ionicons 
                                  name="call-outline" 
                                  size={16} 
                                  color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                                />
                                <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                                  {displayProfile.phone}
                                </Text>
                              </View>
                            )}
                            {displayProfile?.cin && (
                              <View className="flex-row items-center mb-2">
                                <Ionicons 
                                  name="card-outline" 
                                  size={16} 
                                  color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                                />
                                <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                                  CIN: {displayProfile.cin}
                                </Text>
                              </View>
                            )}
                            {displayProfile?.formation_id && (
                              <View className="flex-row items-center mb-2">
                                <Ionicons 
                                  name="school-outline" 
                                  size={16} 
                                  color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                                />
                                <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                                  Formation ID: {displayProfile.formation_id}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </Rolegard>
                    </View>

                    {/* View Full Profile Link */}
                    <View className="mt-4 pt-4 border-t border-light/20 dark:border-dark/20">
                      <View className="flex-row items-center justify-center">
                        <Text className="text-sm text-alpha font-medium mr-2">
                          View Full Profile
                        </Text>
                        <Ionicons 
                          name="arrow-forward" 
                          size={16} 
                          color="#ffc801" 
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Menu Items Section */}
          {menuItems.length > 0 && (
            <View className="px-6 mt-6">
              <Text className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3 uppercase tracking-wide">
                Actions
              </Text>
              <View className="bg-light dark:bg-dark rounded-2xl border border-light/20 dark:border-dark/20 overflow-hidden shadow-sm">
                {menuItems.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={item?.onPress}
                    className={`flex-row items-center py-4 px-4 ${
                      index !== menuItems.length - 1 
                        ? 'border-b border-light/20 dark:border-dark/20' 
                        : ''
                    } active:opacity-70`}
                  >
                    <View className="w-10 h-10 rounded-full bg-alpha/10 dark:bg-alpha/20 items-center justify-center mr-3">
                      <Ionicons 
                        name={item?.icon} 
                        size={22} 
                        color={isDark ? '#ffc801' : '#ffc801'} 
                      />
                    </View>
                    <Text className="flex-1 text-base font-medium text-black dark:text-white">
                      {item?.label}
                    </Text>
                    <Ionicons 
                      name="chevron-forward" 
                      size={20} 
                      color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Settings Section */}
          <View className="px-6 mt-6">
            <Text className="text-sm font-semibold text-black/60 dark:text-white/60 mb-3 uppercase tracking-wide">
              Settings
            </Text>
            <View className="bg-light dark:bg-dark rounded-2xl border border-light/20 dark:border-dark/20 overflow-hidden shadow-sm">
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                className="flex-row items-center py-4 px-4 active:opacity-70"
              >
                <View className="w-10 h-10 rounded-full bg-alpha/10 dark:bg-alpha/20 items-center justify-center mr-3">
                  <Ionicons 
                    name="person-outline" 
                    size={22} 
                    color={isDark ? '#ffc801' : '#ffc801'} 
                  />
                </View>
                <Text className="flex-1 text-base font-medium text-black dark:text-white">
                  Edit Profile
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={20} 
                  color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Logout Section */}
          <View className="px-6 mt-6 mb-6">
            <Pressable 
              onPress={logout} 
              className="bg-red-500 dark:bg-red-600 rounded-2xl py-4 shadow-sm active:opacity-80"
            >
              <View className="flex-row items-center justify-center">
                <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text className="text-center text-white font-semibold text-base">
                  Log out
                </Text>
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </AppLayout>
  );
}



