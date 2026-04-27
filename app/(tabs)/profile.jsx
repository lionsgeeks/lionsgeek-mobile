import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Pressable, ActivityIndicator } from 'react-native';
import { useAppContext } from '@/context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import CreatePost from '@/components/feed/CreatePost';
import FeedItem from '@/components/feed/FeedItem';
import Rolegard from '@/components/Rolegard';

export default function ProfileScreen() {
  const { user: currentUser, token } = useAppContext();
  const { userId } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posts] = useState([]);

  const isOwnProfile = !userId || userId === currentUser?.id?.toString();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token && !isOwnProfile) return;
      
      try {
        if (isOwnProfile) {
          // Fetch own profile
          const response = await API.getWithAuth('mobile/profile', token);
          if (response?.data) {
            setProfile(response.data);
          } else {
            setProfile(currentUser);
          }
        } else {
          // Fetch other user's profile
          const response = await API.getWithAuth(`mobile/profile/${userId}`, token);
          if (response?.data) {
            setProfile(response.data);
          }
        }
      } catch (error) {
        console.error('[PROFILE] Error:', error);
        if (isOwnProfile) {
          setProfile(currentUser);
        }
      } finally {
        setLoading(false);
      }
    };

    if (token || isOwnProfile) {
      fetchProfile();
    }
  }, [token, userId, isOwnProfile, currentUser]);

  if (loading) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
          <ActivityIndicator size="large" color={isDark ? '#fff' : '#000'} />
          <Text className="text-black/60 dark:text-white/60 mt-4">Loading profile...</Text>
        </View>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-black/60 dark:text-white/60">Profile not found</Text>
        </View>
      </AppLayout>
    );
  }

  const getImageUrl = () => {
    if (profile?.avatar) return profile.avatar;
    if (profile?.image) return `${API.APP_URL}/storage/img/profile/${profile.image}`;
    return 'https://via.placeholder.com/100';
  };

  return (
    <AppLayout showNavbar={false}>
      <ScrollView className="flex-1 bg-light dark:bg-dark" showsVerticalScrollIndicator={false}>
        {/* LinkedIn-style Header with Cover */}
        <View className="relative">
          
          {/* Cover Image */}
          <View className="h-52 bg-alpha/20 dark:bg-alpha/30">
            {profile?.cover ? (
              <Image
                source={{ uri: `${API.APP_URL}/storage/${profile.cover}` }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : null}
          </View>
          
          {/* Profile Header */}
          <View className="bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 pb-6">
            <View className="flex-row items-center justify-between px-6 -mt-24 mb-4">
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
              {/* <Text className="text-lg font-bold text-black dark:text-white">Profile</Text> */}
              {/* <TouchableOpacity>
                <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity> */}
            </View>

            {/* Profile Picture and Info */}
            <View className="px-6">
              <View className="items-center mb-4">
                <View className="relative">
                  
                  <Image
                    source={{ uri: `${API.APP_URL}/storage/img/profile/${profile.image}` }}
                    className="w-32 h-32 rounded-full mb-3 border-4 border-light dark:border-dark"
                    defaultSource={require('@/assets/images/icon.png')}
                  />
                </View>
                
                {/* Last Online Indicator - Below Profile Image */}
                {profile?.last_online && (() => {
                  const lastOnlineDate = new Date(profile.last_online);
                  const now = new Date();
                  const diffMinutes = Math.floor((now - lastOnlineDate) / (1000 * 60));
                  const diffHours = Math.floor(diffMinutes / 60);
                  const diffDays = Math.floor(diffHours / 24);
                  
                  // Show green dot if online (last 5 minutes) or just online
                  const isOnline = diffMinutes <= 5;
                  
                  return (
                    <View className="flex-row items-center justify-center mb-3">
                      {isOnline ? (
                        <View className="flex-row items-center">
                          <View className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                        </View>
                      ) : (
                        <Text className="text-xs text-black/60 dark:text-white/60">
                          {diffDays > 0 ? (
                            `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
                          ) : diffHours > 0 ? (
                            `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
                          ) : (
                            `${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago`
                          )}
                        </Text>
                      )}
                    </View>
                  );
                })()}
                
                <Text className="text-2xl font-bold text-black dark:text-white mb-1">
                  {profile?.name || 'User'}
                </Text>
                <Text className="text-sm text-black/60 dark:text-white/60 mb-1">
                  {profile?.email || ''}
                </Text>
                {profile?.status && (
                  <Text className="text-xs text-black/50 dark:text-white/50 mb-1">
                    {profile.status}
                  </Text>
                )}
                {profile?.promo && (
                  <Text className="text-xs text-black/50 dark:text-white/50 mb-2">
                    {profile.promo}
                  </Text>
                )}
                {profile?.roles && profile.roles.length > 0 && (
                  <View className="flex-row items-center flex-wrap justify-center mt-2">
                    {profile.roles.map((role, idx) => (
                      <View key={idx} className="px-3 py-1 rounded-full bg-alpha/20 mr-2 mb-1">
                        <Text className="text-xs font-medium text-alpha capitalize">
                          {role}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Stats - LinkedIn style */}
              <View className="flex-row justify-around mb-4 py-4 border-t border-light/20 dark:border-dark/20">
                <TouchableOpacity className="items-center" onPress={() => {}}>
                  <Text className="text-xl font-bold text-black dark:text-white">
                    {profile?.posts_count ?? 0}
                  </Text>
                  <Text className="text-xs text-black/60 dark:text-white/60 mt-1">Posts</Text>
                </TouchableOpacity>
                <TouchableOpacity className="items-center" onPress={() => {}}>
                  <Text className="text-xl font-bold text-black dark:text-white">
                    {profile?.followers_count ?? 0}
                  </Text>
                  <Text className="text-xs text-black/60 dark:text-white/60 mt-1">Followers</Text>
                </TouchableOpacity>
                <TouchableOpacity className="items-center" onPress={() => {}}>
                  <Text className="text-xl font-bold text-black dark:text-white">
                    {profile?.following_count ?? 0}
                  </Text>
                  <Text className="text-xs text-black/60 dark:text-white/60 mt-1">Following</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons */}
              {isOwnProfile ? (
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => {}}
                    className="flex-1 bg-alpha dark:bg-alpha rounded-xl py-3 items-center flex-row justify-center active:opacity-80"
                  >
                    <Ionicons name="create-outline" size={18} color="#000" />
                    <Text className="ml-2 text-base font-semibold text-black">Edit Profile</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {}}
                    className="px-4 py-3 border border-light/30 dark:border-dark/30 rounded-xl items-center justify-center bg-light/50 dark:bg-dark/50 active:opacity-80"
                  >
                    <Ionicons name="settings-outline" size={20} color={isDark ? '#fff' : '#000'} />
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => {}}
                    className="flex-1 bg-alpha dark:bg-alpha rounded-xl py-3 items-center flex-row justify-center active:opacity-80"
                  >
                    <Ionicons name="person-add-outline" size={18} color="#000" />
                    <Text className="ml-2 text-base font-semibold text-black">Connect</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {}}
                    className="px-4 py-3 border border-light/30 dark:border-dark/30 rounded-xl items-center justify-center bg-light/50 dark:bg-dark/50 active:opacity-80"
                  >
                    <Ionicons name="mail-outline" size={20} color={isDark ? '#fff' : '#000'} />
                  </Pressable>
                  <Pressable
                    onPress={() => {}}
                    className="px-4 py-3 border border-light/30 dark:border-dark/30 rounded-xl items-center justify-center bg-light/50 dark:bg-dark/50 active:opacity-80"
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={isDark ? '#fff' : '#000'} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Content Section */}
        <View className="px-6 pt-6 pb-8">
          {/* About Section */}
          <View className="bg-light dark:bg-dark rounded-xl p-4 mb-4 border border-light/20 dark:border-dark/20">
            <Text className="text-lg font-bold text-black dark:text-white mb-3">About</Text>
            
            {/* Public Info */}
            <View className="mb-3">
              {profile?.status && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="briefcase-outline" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                  <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                    {profile.status}
                  </Text>
                </View>
              )}
              {profile?.promo && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="school-outline" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                  <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                    Promo: {profile.promo}
                  </Text>
                </View>
              )}
              {profile?.created_at && (
                <View className="flex-row items-center mb-2">
                  <Ionicons name="calendar-outline" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                  <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                    Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                </View>
              )}
            </View>

            {/* Sensitive Info - Admin Only */}
            <Rolegard authorized={['admin', 'coach']}>
              <View className="pt-3 border-t border-light/20 dark:border-dark/20">
                <Text className="text-xs font-semibold text-black/50 dark:text-white/50 mb-2 uppercase">Admin Details</Text>
                {profile?.phone && (
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="call-outline" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                    <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                      {profile.phone}
                    </Text>
                  </View>
                )}
                {profile?.cin && (
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="card-outline" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                    <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                      CIN: {profile.cin}
                    </Text>
                  </View>
                )}
                {profile?.formation_id && (
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="school-outline" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
                    <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                      Formation ID: {profile.formation_id}
                    </Text>
                  </View>
                )}
                {profile?.access_cowork !== undefined && (
                  <View className="flex-row items-center mb-2">
                    <Ionicons 
                      name={profile.access_cowork ? "business" : "business-outline"} 
                      size={18} 
                      color={profile.access_cowork ? (isDark ? '#fff' : '#000') : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')} 
                    />
                    <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                      Cowork Space
                    </Text>
                  </View>
                )}
                {profile?.access_studio !== undefined && (
                  <View className="flex-row items-center mb-2">
                    <Ionicons 
                      name={profile.access_studio ? "videocam" : "videocam-outline"} 
                      size={18} 
                      color={profile.access_studio ? (isDark ? '#fff' : '#000') : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')} 
                    />
                    <Text className="text-sm text-black/80 dark:text-white/80 ml-2">
                      Studio
                    </Text>
                  </View>
                )}
              </View>
            </Rolegard>
          </View>

          {/* Create Post (only for own profile) */}
          {isOwnProfile && (
            <View className="mb-4">
              <CreatePost onPostPress={() => {}} />
            </View>
          )}

          {/* Posts Section */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-black dark:text-white">
                {isOwnProfile ? 'Your Posts' : 'Posts'}
              </Text>
              {posts.length > 0 && (
                <TouchableOpacity>
                  <Text className="text-sm text-alpha">See all</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {posts.length === 0 ? (
              <View className="py-12 items-center bg-light/50 dark:bg-dark/50 rounded-xl">
                <Ionicons name="document-text-outline" size={48} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                <Text className="text-center text-black/60 dark:text-white/60 mt-4">
                  No posts yet
                </Text>
              </View>
            ) : (
              posts.map((post) => (
                <FeedItem key={post.id} item={post} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </AppLayout>
  );
}
