import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Modal,
  StatusBar,
} from 'react-native';
import { useAppContext } from '@/context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import CreatePost from '@/components/feed/CreatePost';
import FeedItem from '@/components/feed/FeedItem';
import Rolegard from '@/components/Rolegard';
import Skeleton from '@/components/ui/Skeleton';
import {
  resolveAvatarUrl,
  resolvePostMediaUrl,
  resolveCoverUrl,
  userHasAdminRole,
} from '@/components/helpers/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 1.5;
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

function OnlineBadge({ lastOnline }) {
  if (!lastOnline) return null;

  const diffMinutes = Math.floor((Date.now() - new Date(lastOnline)) / 60000);
  const isOnline = diffMinutes <= 5;

  if (!isOnline) return null;

  return (
    <View
      className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-good border-2 border-light dark:border-dark"
    />
  );
}

function StatColumn({ label, value, onPress }) {
  return (
    <TouchableOpacity className="items-center flex-1" onPress={onPress} activeOpacity={0.7}>
      <Text className="text-lg font-bold text-black dark:text-white">{value ?? 0}</Text>
      <Text className="text-xs text-black/50 dark:text-white/50 mt-0.5">{label}</Text>
    </TouchableOpacity>
  );
}

function GridCell({ post, onPress, isDark }) {
  const hasImage = !!post.postImage;

  return (
    <TouchableOpacity
      style={{ width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE }}
      onPress={() => onPress(post)}
      activeOpacity={0.85}
    >
      {hasImage ? (
        <Image
          source={{ uri: post.postImage }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{ width: '100%', height: '100%' }}
          className="bg-alpha/10 dark:bg-alpha/5 items-center justify-center p-2"
        >
          <Ionicons
            name="document-text-outline"
            size={22}
            color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
          />
          {post.body ? (
            <Text
              numberOfLines={3}
              className="text-xs text-black/50 dark:text-white/50 text-center mt-1 leading-4"
            >
              {post.body}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

function PostsGrid({ posts, isDark, onCellPress }) {
  if (posts.length === 0) return null;

  const rows = [];
  for (let i = 0; i < posts.length; i += GRID_COLUMNS) {
    rows.push(posts.slice(i, i + GRID_COLUMNS));
  }

  return (
    <View>
      {rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={{ flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP }}
        >
          {row.map((post) => (
            <GridCell key={post.id} post={post} isDark={isDark} onPress={onCellPress} />
          ))}
          {/* Fill empty slots in last row */}
          {row.length < GRID_COLUMNS &&
            Array.from({ length: GRID_COLUMNS - row.length }).map((_, idx) => (
              <View key={`empty-${idx}`} style={{ width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE }} />
            ))}
        </View>
      ))}
    </View>
  );
}

function ProfileSkeleton({ isDark }) {
  return (
    <View className="flex-1 bg-light dark:bg-dark">
      {/* Cover */}
      <View className="h-44 bg-alpha/10 dark:bg-alpha/5" />

      {/* Profile Row */}
      <View className="flex-row items-start px-4 -mt-12 mb-3">
        <Skeleton width={90} height={90} borderRadius={45} isDark={isDark} />
        <View className="flex-1 flex-row justify-around mt-14 ml-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="items-center gap-1">
              <Skeleton width={36} height={16} borderRadius={8} isDark={isDark} />
              <Skeleton width={52} height={10} borderRadius={8} isDark={isDark} />
            </View>
          ))}
        </View>
      </View>

      {/* Bio */}
      <View className="px-4 gap-2 mb-4">
        <Skeleton width={160} height={16} borderRadius={8} isDark={isDark} />
        <Skeleton width={120} height={12} borderRadius={8} isDark={isDark} />
        <Skeleton width={200} height={12} borderRadius={8} isDark={isDark} />
      </View>

      {/* Buttons */}
      <View className="px-4 flex-row gap-2 mb-5">
        <Skeleton width="75%" height={40} borderRadius={10} isDark={isDark} />
        <Skeleton width={40} height={40} borderRadius={10} isDark={isDark} />
        <Skeleton width={40} height={40} borderRadius={10} isDark={isDark} />
      </View>

      {/* Grid placeholder */}
      <View className="border-t border-black/10 dark:border-white/10 mb-2" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width={GRID_ITEM_SIZE} height={GRID_ITEM_SIZE} borderRadius={0} isDark={isDark} />
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { user: currentUser, token } = useAppContext();
  const { userId, id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);

  const resolvedUserId = userId ?? id;
  const isOwnProfile = !resolvedUserId || resolvedUserId === currentUser?.id?.toString();

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setPosts([]);
  }, [resolvedUserId]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!token && !isOwnProfile) return;
      if (isOwnProfile && !token && !currentUser) return;

      try {
        if (isOwnProfile) {
          if (!token) {
            setProfile(currentUser);
            return;
          }
          const response = await API.getWithAuth('mobile/profile', token);
          setProfile(response?.data || currentUser);
        } else {
          const response = await API.getWithAuth(`mobile/profile/${resolvedUserId}`, token);
          if (response?.data) setProfile(response.data);
        }
      } catch (error) {
        console.error('[PROFILE] fetch error:', error);
        if (isOwnProfile) setProfile(currentUser);
      } finally {
        setLoading(false);
      }
    };

    if (token || (isOwnProfile && currentUser)) fetchProfile();
  }, [token, resolvedUserId, isOwnProfile, currentUser]);

  useEffect(() => {
    const fetchUserPosts = async () => {
      if (!token || !profile?.id) return;

      setPostsLoading(true);
      try {
        const response = await API.getWithAuth('mobile/feed', token);
        const feedData = response?.data?.feed || response?.data?.posts || [];
        const list = Array.isArray(feedData) ? feedData : [];

        const filtered = list.filter((post) => {
          const postUserId = post?.user?.id ?? post?.author?.id ?? post?.user_id ?? post?.userId;
          return postUserId != null && Number(postUserId) === Number(profile.id);
        });

        const normalized = filtered.map((post) => {
          const userAvatar =
            post.user?.avatar || post.author?.avatar || post.user_avatar || post.author_avatar;
          const userImage =
            post.user?.image || post.author?.image || post.user_image || post.author_image;
          const avatarUrl = resolveAvatarUrl(userAvatar || userImage);

          const normalizedUser = {
            ...(post.user || post.author || {}),
            id:
              post.user?.id || post.author?.id || post.user_id || post.userId || profile.id,
            name:
              post.user?.name ||
              post.author?.name ||
              post.user_name ||
              post.author_name ||
              profile?.name ||
              'Unknown',
            avatar: avatarUrl,
            image: userImage,
          };

          const mediaUrl = resolvePostMediaUrl(post);

          return {
            ...post,
            user: normalizedUser,
            userAvatar: avatarUrl,
            postImage: mediaUrl,
            image: mediaUrl,
          };
        });

        setPosts(normalized);
      } catch (error) {
        console.error('[PROFILE] fetch posts error:', error);
        setPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };

    fetchUserPosts();
  }, [token, profile?.id, profile?.name]);

  const profileImageUrl = profile
    ? resolveAvatarUrl(profile?.avatar || profile?.image)
    : null;

  const coverImageUrl = profile?.cover ? resolveCoverUrl(profile.cover) : null;

  if (loading) {
    return (
      <AppLayout showNavbar={false}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <ProfileSkeleton isDark={isDark} />
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
          <Ionicons name="person-circle-outline" size={64} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
          <Text className="text-black/50 dark:text-white/50 mt-4 text-base">Profile not found</Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNavbar={false}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── Sticky Top Bar ─── */}
      <View
        className="flex-row items-center justify-between px-4 py-3 bg-light dark:bg-dark border-b border-black/5 dark:border-white/5"
        style={{ zIndex: 10 }}
      >
        {isOwnProfile && !userId ? (
          <View style={{ width: 28 }} />
        ) : (
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        )}

        <Text className="text-base font-bold text-black dark:text-white tracking-wide">
          {profile?.name || 'Profile'}
        </Text>

        {isOwnProfile ? (
          <TouchableOpacity onPress={() => router.push('/more')} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="menu-outline" size={26} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        className="flex-1 bg-light dark:bg-dark"
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* ─── Cover Image ─── */}
        <View className="h-44 bg-alpha/10 dark:bg-alpha/5 overflow-hidden">
          {coverImageUrl ? (
            <Image source={{ uri: coverImageUrl }} className="w-full h-full" resizeMode="cover" />
          ) : (
            /* Lionsgeek branded gradient fallback */
            <View className="w-full h-full bg-alpha/20 dark:bg-alpha/10 items-center justify-center">
              <Text className="text-alpha/30 text-6xl font-black tracking-widest">LG</Text>
            </View>
          )}
        </View>

        {/* ─── Profile Row: Avatar + Stats ─── */}
        <View className="flex-row items-start px-4 -mt-11 mb-3">
          {/* Avatar */}
          <View className="relative">
            <View
              className="rounded-full border-4 border-light dark:border-dark overflow-hidden"
              style={{ width: 90, height: 90 }}
            >
              {profileImageUrl ? (
                <Image
                  source={{ uri: profileImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full bg-alpha/20 items-center justify-center">
                  <Ionicons name="person" size={36} color={isDark ? '#fff' : '#000'} />
                </View>
              )}
            </View>
            <OnlineBadge lastOnline={profile?.last_online} />
          </View>

          {/* Stats */}
          <View className="flex-1 flex-row justify-around mt-14 ml-2">
            <StatColumn label="Posts" value={profile?.posts_count ?? posts.length} />
            <StatColumn label="Followers" value={profile?.followers_count ?? 0} />
            <StatColumn label="Following" value={profile?.following_count ?? 0} />
          </View>
        </View>

        {/* ─── Bio Section ─── */}
        <View className="px-4 mb-4">
          <Text className="text-base font-bold text-black dark:text-white leading-tight">
            {profile?.name || 'User'}
          </Text>

          {/* Role badges */}
          {profile?.roles && profile.roles.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1.5">
              {profile.roles.map((role, idx) => (
                <View key={idx} className="px-2.5 py-0.5 rounded-full bg-alpha">
                  <Text className="text-xs font-semibold text-beta capitalize">{role}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Status / promo / email */}
          {profile?.status ? (
            <Text className="text-sm text-black/70 dark:text-white/70 mt-1.5 leading-5">
              {profile.status}
            </Text>
          ) : null}
          {profile?.promo ? (
            <Text className="text-sm text-black/50 dark:text-white/50 mt-0.5">
              Promo {profile.promo}
            </Text>
          ) : null}
          {(isOwnProfile || userHasAdminRole(currentUser)) && profile?.email ? (
            <Text className="text-sm text-alpha mt-0.5">{profile.email}</Text>
          ) : null}
          {profile?.created_at ? (
            <View className="flex-row items-center mt-1.5 gap-1">
              <Ionicons
                name="calendar-outline"
                size={13}
                color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
              />
              <Text className="text-xs text-black/40 dark:text-white/40">
                Joined{' '}
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ─── Action Buttons ─── */}
        <View className="px-4 flex-row gap-2 mb-5">
          {isOwnProfile ? (
            <>
              <Pressable
                onPress={() => {}}
                className="flex-1 bg-alpha rounded-xl py-2.5 items-center flex-row justify-center active:opacity-70"
              >
                <Ionicons name="create-outline" size={17} color="#212529" />
                <Text className="ml-1.5 text-sm font-bold text-beta">Edit Profile</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowCreatePost(true)}
                className="px-4 py-2.5 rounded-xl border border-black/15 dark:border-white/15 items-center justify-center active:opacity-70"
              >
                <Ionicons name="add-outline" size={20} color={isDark ? '#fff' : '#000'} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/more')}
                className="px-4 py-2.5 rounded-xl border border-black/15 dark:border-white/15 items-center justify-center active:opacity-70"
              >
                <Ionicons name="settings-outline" size={19} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => {}}
                className="flex-1 bg-alpha rounded-xl py-2.5 items-center flex-row justify-center active:opacity-70"
              >
                <Ionicons name="person-add-outline" size={17} color="#212529" />
                <Text className="ml-1.5 text-sm font-bold text-beta">Follow</Text>
              </Pressable>
              <Pressable
                onPress={() => {}}
                className="flex-1 rounded-xl py-2.5 border border-black/15 dark:border-white/15 items-center flex-row justify-center active:opacity-70"
              >
                <Ionicons name="mail-outline" size={17} color={isDark ? '#fff' : '#000'} />
                <Text className="ml-1.5 text-sm font-semibold text-black dark:text-white">Message</Text>
              </Pressable>
              <Pressable
                onPress={() => {}}
                className="px-4 py-2.5 rounded-xl border border-black/15 dark:border-white/15 items-center justify-center active:opacity-70"
              >
                <Ionicons name="chevron-down" size={18} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            </>
          )}
        </View>

        {/* ─── Admin Details (Rolegard) ─── */}
        <Rolegard authorized={['admin', 'coach']}>
          <View className="mx-4 mb-5 rounded-xl bg-beta/5 dark:bg-white/5 p-4 border border-black/8 dark:border-white/8">
            <Text className="text-xs font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mb-3">
              Admin Details
            </Text>
            {profile?.phone && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="call-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text className="text-sm text-black/70 dark:text-white/70 ml-2">{profile.phone}</Text>
              </View>
            )}
            {profile?.cin && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="card-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text className="text-sm text-black/70 dark:text-white/70 ml-2">CIN: {profile.cin}</Text>
              </View>
            )}
            {profile?.formation_id && (
              <View className="flex-row items-center mb-2">
                <Ionicons name="school-outline" size={15} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                <Text className="text-sm text-black/70 dark:text-white/70 ml-2">Formation ID: {profile.formation_id}</Text>
              </View>
            )}
            <View className="flex-row gap-4 mt-1">
              {profile?.access_cowork !== undefined && (
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={profile.access_cowork ? 'business' : 'business-outline'}
                    size={15}
                    color={profile.access_cowork ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')}
                  />
                  <Text
                    className={`text-xs ${profile.access_cowork ? 'text-alpha font-semibold' : 'text-black/30 dark:text-white/30'}`}
                  >
                    Cowork
                  </Text>
                </View>
              )}
              {profile?.access_studio !== undefined && (
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={profile.access_studio ? 'videocam' : 'videocam-outline'}
                    size={15}
                    color={profile.access_studio ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)')}
                  />
                  <Text
                    className={`text-xs ${profile.access_studio ? 'text-alpha font-semibold' : 'text-black/30 dark:text-white/30'}`}
                  >
                    Studio
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Rolegard>

        {/* ─── Posts Tab Bar ─── */}
        <View className="flex-row border-t border-black/10 dark:border-white/10 mb-0.5">
          <View className="flex-1 items-center py-2.5 border-b-2 border-alpha">
            <Ionicons name="grid-outline" size={22} color="#ffc801" />
          </View>
        </View>

        {/* ─── Posts Grid ─── */}
        {postsLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton
                key={i}
                width={GRID_ITEM_SIZE}
                height={GRID_ITEM_SIZE}
                borderRadius={0}
                isDark={isDark}
              />
            ))}
          </View>
        ) : posts.length === 0 ? (
          <View className="py-20 items-center">
            <Ionicons
              name="camera-outline"
              size={52}
              color={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}
            />
            <Text className="text-black/40 dark:text-white/40 mt-4 text-sm font-medium">
              No posts yet
            </Text>
            {isOwnProfile && (
              <Text className="text-black/30 dark:text-white/30 text-xs mt-1">
                Share your first moment with the community
              </Text>
            )}
          </View>
        ) : (
          <PostsGrid posts={posts} isDark={isDark} onCellPress={setSelectedPost} />
        )}

        {/* Bottom spacer */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ─── Create Post Modal ─── */}
      {showCreatePost && (
        <Modal
          visible={showCreatePost}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCreatePost(false)}
        >
          <View className="flex-1 bg-light dark:bg-dark pt-4">
            <View className="flex-row items-center justify-between px-4 mb-4">
              <Text className="text-lg font-bold text-black dark:text-white">New Post</Text>
              <TouchableOpacity onPress={() => setShowCreatePost(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
            <CreatePost onPostPress={() => setShowCreatePost(false)} />
          </View>
        </Modal>
      )}

      {/* ─── Post Detail Modal ─── */}
      {selectedPost && (
        <Modal
          visible={!!selectedPost}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedPost(null)}
        >
          <View className="flex-1 bg-light dark:bg-dark">
            <View className="flex-row items-center px-4 py-3 border-b border-black/10 dark:border-white/10">
              <TouchableOpacity onPress={() => setSelectedPost(null)} hitSlop={12}>
                <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
              <Text className="ml-3 text-base font-bold text-black dark:text-white">Post</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <FeedItem item={selectedPost} />
            </ScrollView>
          </View>
        </Modal>
      )}
    </AppLayout>
  );
}
