import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  Image,
  TouchableOpacity,
  Pressable,
  Dimensions,
  Modal,
  StatusBar,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AppLayout from '@/components/layout/AppLayout';
import CreatePost from '@/components/feed/CreatePost';
import FeedItem from '@/components/feed/FeedItem';
import Rolegard from '@/components/Rolegard';
import Skeleton from '@/components/ui/Skeleton';
import EditProfileModal from '@/components/profile/EditProfileModal';
import {
  resolveAvatarUrl,
  resolvePostMediaUrl,
  resolveCoverUrl,
} from '@/components/helpers/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 1.5;
const GRID_COLUMNS = 3;
const GRID_ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

function getLastExperience(profile) {
  const candidates =
    profile?.experiences ??
    profile?.experience ??
    profile?.user_experiences ??
    profile?.userExperiences ??
    [];

  const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  if (list.length === 0) return null;

  const score = (exp) => {
    const date =
      exp?.end_date ??
      exp?.endDate ??
      exp?.to ??
      exp?.until ??
      exp?.created_at ??
      exp?.createdAt ??
      exp?.updated_at ??
      exp?.updatedAt ??
      null;

    const ts = date ? new Date(date).getTime() : NaN;
    return Number.isFinite(ts) ? ts : -Infinity;
  };

  const sorted = [...list].sort((a, b) => score(b) - score(a));
  const best = sorted[0];
  return best ?? list[list.length - 1] ?? null;
}

function normalizeSocialLinks(profile, fallbackList = []) {
  const fromProfile =
    profile?.social_links ??
    profile?.socialLinks ??
    profile?.social_links_list ??
    profile?.links ??
    null;

  const list = Array.isArray(fromProfile) ? fromProfile : Array.isArray(fallbackList) ? fallbackList : [];
  return list
    .filter(Boolean)
    .map((l) => ({
      id: l?.id ?? `${l?.title ?? ''}:${l?.url ?? ''}`,
      title: String(l?.title ?? l?.platform ?? '').toLowerCase(),
      url: String(l?.url ?? l?.link ?? '').trim(),
    }))
    .filter((l) => l.url.length > 0);
}

function iconForSocialTitle(title) {
  const t = String(title ?? '').toLowerCase();
  if (t.includes('github')) return 'logo-github';
  if (t.includes('linkedin')) return 'logo-linkedin';
  if (t.includes('instagram')) return 'logo-instagram';
  if (t.includes('behance')) return 'color-palette-outline';
  if (t.includes('portfolio') || t.includes('website') || t.includes('site')) return 'globe-outline';
  return 'link-outline';
}

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

// ─── Follow List Modal (shared for followers + following) ───────────────────

function FollowUserRow({ user, isDark, currentUserId, token, onPress }) {
  const avatarUrl = resolveAvatarUrl(user.avatar || user.image);
  const isSelf = Number(user.id) === Number(currentUserId);

  // Initialised from the API field; toggled optimistically on press.
  const [isFollowing, setIsFollowing] = useState(!!user.is_following);
  const [followLoading, setFollowLoading] = useState(false);

  const handleFollow = async () => {
    if (followLoading) return;
    const next = !isFollowing;
    setIsFollowing(next); // optimistic
    setFollowLoading(true);
    try {
      await API.postWithAuth(`mobile/users/${user.id}/follow`, {}, token);
    } catch (err) {
      console.error('[FOLLOW] error:', err);
      setIsFollowing(!next); // revert on failure
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3"
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View className="w-12 h-12 rounded-full overflow-hidden bg-alpha/10 items-center justify-center mr-3">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name="person" size={22} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
        )}
      </View>

      {/* Info */}
      <View className="flex-1 mr-3">
        <Text className="text-sm font-semibold text-black dark:text-white" numberOfLines={1}>
          {user.name}
        </Text>
        {user.status ? (
          <Text className="text-xs text-black/50 dark:text-white/50 mt-0.5" numberOfLines={1}>
            {user.status}
          </Text>
        ) : user.promo ? (
          <Text className="text-xs text-black/50 dark:text-white/50 mt-0.5">Promo {user.promo}</Text>
        ) : null}
      </View>

      {/* Follow button — hidden for the current user's own row */}
      {!isSelf && (
        <Pressable
          onPress={handleFollow}
          disabled={followLoading}
          className={`px-4 py-1.5 rounded-lg ${isFollowing
            ? 'border border-black/20 dark:border-white/20 bg-transparent'
            : 'bg-alpha'
            }`}
          style={{ opacity: followLoading ? 0.5 : 1 }}
        >
          <Text
            className={`text-xs font-bold ${isFollowing ? 'text-black dark:text-white' : 'text-beta'
              }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </TouchableOpacity>
  );
}

function FollowListModal({ visible, type, profileId, token, currentUserId, insets, isDark, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch only when the modal opens
  useEffect(() => {
    if (!visible || !profileId || !token) return;

    const endpoint = `mobile/profile/${profileId}/${type}`;
    setLoading(true);
    setError(null);
    setUsers([]);

    API.getWithAuth(endpoint, token)
      .then((res) => setUsers(res?.data?.data || []))
      .catch((err) => {
        console.error(`[PROFILE] ${type} fetch error:`, err);
        setError('Could not load list. Try again.');
      })
      .finally(() => setLoading(false));
  }, [visible, profileId, type, token]);

  const title = type === 'followers' ? 'Followers' : 'Following';

  const handleUserPress = (user) => {
    onClose();
    router.push({ pathname: '/(tabs)/profile', params: { userId: user.id } });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-light dark:bg-dark">
        {/* Header */}
        <View
          className="flex-row items-center px-4 bg-light dark:bg-dark border-b border-black/10 dark:border-white/10"
          style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text className="ml-3 text-base font-bold text-black dark:text-white">{title}</Text>
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 px-4 pt-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} className="flex-row items-center gap-3">
                <Skeleton width={48} height={48} borderRadius={24} isDark={isDark} />
                <View className="flex-1 gap-2">
                  <Skeleton width="55%" height={13} borderRadius={8} isDark={isDark} />
                  <Skeleton width="38%" height={10} borderRadius={8} isDark={isDark} />
                </View>
              </View>
            ))}
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="cloud-offline-outline" size={48} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
            <Text className="text-black/50 dark:text-white/50 mt-4 text-sm text-center">{error}</Text>
          </View>
        ) : users.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="people-outline" size={52} color={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'} />
            <Text className="text-black/40 dark:text-white/40 mt-4 text-sm font-medium">
              No {title.toLowerCase()} yet
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <FollowUserRow
                user={item}
                isDark={isDark}
                currentUserId={currentUserId}
                token={token}
                onPress={handleUserPress}
              />
            )}
            ItemSeparatorComponent={() => (
              <View className="h-px mx-4 bg-black/5 dark:bg-white/5" />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        )}
      </View>
    </Modal>
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

function ProfileSkeleton({ isDark, topInset = 0 }) {
  return (
    <View className="flex-1 bg-light dark:bg-dark">
      {/* Skeleton top bar placeholder */}
      <View style={{ height: topInset + 46 }} className="bg-light dark:bg-dark border-b border-black/5 dark:border-white/5" />
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
  const [coverUploading, setCoverUploading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(-1);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [followModal, setFollowModal] = useState(null); // 'followers' | 'following' | null
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [socialLinks, setSocialLinks] = useState([]);
  const feedListRef = useRef(null);

  const insets = useSafeAreaInsets();

  const resolvedUserId = userId ?? id;
  const isOwnProfile = !resolvedUserId || resolvedUserId === currentUser?.id?.toString();

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    setPosts([]);
    setSocialLinks([]);
  }, [resolvedUserId]);

  const loadProfile = useCallback(async () => {
    if (!token && !isOwnProfile) return;
    if (isOwnProfile && !token && !currentUser) return;

    try {
      if (isOwnProfile) {
        if (!token) { setProfile(currentUser); return; }
        const res = await API.getWithAuth('mobile/profile', token);
        setProfile(res?.data || currentUser);
      } else {
        const res = await API.getWithAuth(`mobile/profile/${resolvedUserId}`, token);
        if (res?.data) setProfile(res.data);
      }
    } catch (err) {
      console.error('[PROFILE] fetch error:', err);
      if (isOwnProfile) setProfile(currentUser);
    } finally {
      setLoading(false);
    }
  }, [token, resolvedUserId, isOwnProfile, currentUser]);

  const loadPosts = useCallback(async (profileId, profileName) => {
    if (!token || !profileId) return;

    setPostsLoading(true);
    try {
      const res = await API.getWithAuth('mobile/feed', token);
      const list = Array.isArray(res?.data?.feed ?? res?.data?.posts)
        ? (res?.data?.feed ?? res?.data?.posts)
        : [];

      const normalized = list
        .filter((post) => {
          const pid = post?.user?.id ?? post?.author?.id ?? post?.user_id ?? post?.userId;
          return pid != null && Number(pid) === Number(profileId);
        })
        .map((post) => {
          const userAvatar = post.user?.avatar || post.author?.avatar || post.user_avatar || post.author_avatar;
          const userImage = post.user?.image || post.author?.image || post.user_image || post.author_image;
          const avatarUrl = resolveAvatarUrl(userAvatar || userImage);
          const mediaUrl = resolvePostMediaUrl(post);
          return {
            ...post,
            user: {
              ...(post.user || post.author || {}),
              id: post.user?.id || post.author?.id || post.user_id || post.userId || profileId,
              name: post.user?.name || post.author?.name || post.user_name || post.author_name || profileName || 'Unknown',
              avatar: avatarUrl,
              image: userImage,
            },
            userAvatar: avatarUrl,
            postImage: mediaUrl,
            image: mediaUrl,
          };
        });

      setPosts(normalized);
    } catch (err) {
      console.error('[PROFILE] fetch posts error:', err);
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (token || (isOwnProfile && currentUser)) loadProfile();
  }, [loadProfile, token, isOwnProfile, currentUser]);

  const loadSocialLinks = useCallback(async () => {
    // For now the app only has a secured "my social links" endpoint.
    // When viewing other users, we rely on any links embedded in the profile payload.
    if (!token || !isOwnProfile) {
      setSocialLinks(normalizeSocialLinks(profile, []));
      return;
    }

    try {
      const res = await API.getWithAuth('mobile/profile/social-links', token);
      const list = res?.data?.data ?? [];
      setSocialLinks(normalizeSocialLinks(profile, list));
    } catch (err) {
      console.error('[PROFILE] social links fetch error:', err);
      setSocialLinks(normalizeSocialLinks(profile, []));
    }
  }, [token, isOwnProfile, profile]);

  useEffect(() => {
    loadSocialLinks();
  }, [loadSocialLinks, profile]);

  useEffect(() => {
    loadPosts(profile?.id, profile?.name);
  }, [loadPosts, profile?.id, profile?.name]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await Promise.all([loadProfile(), loadPosts(profile?.id, profile?.name)]);
    setRefreshing(false);
  }, [loadProfile, loadPosts, token, profile?.id, profile?.name]);

  // Sync reactive follow state whenever the profile data arrives / refreshes
  useEffect(() => {
    if (!profile) return;
    setIsFollowing(!!profile.is_following);
    setFollowersCount(profile.followers_count ?? 0);
  }, [profile]);

  const handleFollowToggle = async () => {
    if (followLoading || !token || !profile?.id) return;

    const willFollow = !isFollowing;
    // Optimistic update
    setIsFollowing(willFollow);
    setFollowersCount((prev) => prev + (willFollow ? 1 : -1));
    setFollowLoading(true);

    try {
      await API.postWithAuth(`mobile/users/${profile.id}/follow`, {}, token);
    } catch (err) {
      console.error('[PROFILE] follow toggle error:', err);
      // Revert on failure
      setIsFollowing(!willFollow);
      setFollowersCount((prev) => prev + (willFollow ? -1 : 1));
    } finally {
      setFollowLoading(false);
    }
  };

  const profileImageUrl = profile
    ? resolveAvatarUrl(profile?.avatar || profile?.image)
    : null;

  const coverImageUrl = profile?.cover ? resolveCoverUrl(profile.cover) : null;
  const lastExperience = getLastExperience(profile);
  const lastExperienceLocation =
    // Experience object candidates (if experiences are included in payload)
    lastExperience?.location ??
    lastExperience?.city ??
    lastExperience?.place ??
    lastExperience?.address ??
    lastExperience?.region ??
    lastExperience?.country ??
    lastExperience?.company_location ??
    lastExperience?.companyLocation ??
    // Common flattened API fields (if backend doesn't embed experiences array)
    profile?.last_experience_location ??
    profile?.lastExperienceLocation ??
    profile?.experience_location ??
    profile?.experienceLocation ??
    profile?.city ??
    profile?.location ??
    profile?.address ??
    null;
  const speciality = profile?.speciality ?? profile?.specialty ?? null;

  const pickAndUploadCover = useCallback(async () => {
    if (!token || !isOwnProfile || coverUploading) return;

    try {
      setCoverUploading(true);

      const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const coverFile = {
        uri: asset.uri,
        name: 'cover.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      };

      const form = new FormData();
      form.append('cover', coverFile);

      const res = await API.postWithAuth('mobile/profile/cover', form, token);
      const nextCover = res?.data?.data?.cover ?? res?.data?.cover ?? null;

      if (nextCover) {
        setProfile((prev) => (prev ? { ...prev, cover: nextCover } : prev));
      }
    } catch (err) {
      console.error('[PROFILE] cover upload error:', err);
      Alert.alert('Error', 'Could not update cover. Please try again.');
    } finally {
      setCoverUploading(false);
    }
  }, [token, isOwnProfile, coverUploading]);

  if (loading) {
    return (
      <AppLayout showNavbar={false}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
        <ProfileSkeleton isDark={isDark} topInset={insets.top} />
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
        className="flex-row items-center justify-between px-4 bg-light dark:bg-dark border-b border-black/5 dark:border-white/5"
        style={{ paddingTop: insets.top + 10, paddingBottom: 10, zIndex: 10 }}
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffc801"
            colors={['#ffc801']}
          />
        }
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

          {/* Pin edit button (own profile only) */}
          {isOwnProfile && (
            <Pressable
              onPress={pickAndUploadCover}
              disabled={coverUploading}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Edit cover photo"
              className="absolute top-3 right-3 w-10 h-10 rounded-full items-center justify-center border border-white/20 bg-black/40"
              style={{ opacity: coverUploading ? 0.6 : 1 }}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
            </Pressable>
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
            <StatColumn
              label="Followers"
              value={followersCount}
              onPress={() => setFollowModal('followers')}
            />
            <StatColumn
              label="Following"
              value={profile?.following_count ?? 0}
              onPress={() => setFollowModal('following')}
            />
          </View>
        </View>

        {/* ─── Bio Section ─── */}
        <View className="px-4 mb-4">
          <View className="flex-row items-center justify-between">
            <Text
              className="text-xl font-bold text-black dark:text-white leading-tight flex-1 pr-3"
              numberOfLines={1}
            >
              {profile?.name || 'User'}
            </Text>

            {/* Social links (icons, clickable) — aligned with the name */}
            {socialLinks.length > 0 && (
              <View className="flex-row items-center gap-2">
                {socialLinks.map((link) => (
                  <TouchableOpacity
                    key={String(link.id)}
                    activeOpacity={0.75}
                    onPress={async () => {
                      const url = link.url;
                      try {
                        const canOpen = await Linking.canOpenURL(url);
                        if (canOpen) await Linking.openURL(url);
                      } catch (err) {
                        console.error('[PROFILE] open social link error:', err);
                      }
                    }}
                    className="w-8 h-8 rounded-full items-center justify-center border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04]"
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${link.title || 'social'} link`}
                  >
                    <Ionicons
                      name={iconForSocialTitle(link.title)}
                      size={16}
                      color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.75)'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Last experience location + speciality (under the name) */}
          {(lastExperienceLocation || speciality) && (
            <View className="flex-col flex-wrap items-center mt-1 gap-x-3 gap-y-1">
              {speciality ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name="briefcase-outline"
                    size={13}
                    color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'}
                  />
                  <Text className="text-base text-black/60 dark:text-white/60">
                    {String(speciality)}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Role badges */}
          {isOwnProfile && profile?.roles && profile.roles.length > 0 && (
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
          {isOwnProfile && profile?.email ? (
            <Text className="text-sm text-alpha mt-0.5">{profile.email}</Text>
          ) : null}
          <View className='flex-row items-center gap-3'>
            {lastExperienceLocation ? (
              <View className="flex-row items-center gap-1 mt-1">
                <Ionicons
                  name="location-outline"
                  size={13}
                  color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'}
                />
                <Text className="text-xs text-black/40 dark:text-white/40">
                  {String(lastExperienceLocation)}
                </Text>
              </View>
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
        </View>

        {/* ─── Action Buttons ─── */}
        <View className="px-4 flex-row gap-2 mb-5">
          {isOwnProfile ? (
            <>
              <Pressable
                onPress={() => setShowEditProfile(true)}
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
                onPress={handleFollowToggle}
                disabled={followLoading}
                style={{ opacity: followLoading ? 0.6 : 1 }}
                className={`flex-1 rounded-xl py-2.5 items-center flex-row justify-center active:opacity-70 ${isFollowing
                  ? 'border border-black/20 dark:border-white/20 bg-transparent'
                  : 'bg-alpha'
                  }`}
              >
                <Ionicons
                  name={isFollowing ? 'person-remove-outline' : 'person-add-outline'}
                  size={17}
                  color={isFollowing ? (isDark ? '#fff' : '#000') : '#212529'}
                />
                <Text
                  className={`ml-1.5 text-sm font-bold ${isFollowing ? 'text-black dark:text-white' : 'text-beta'
                    }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { }}
                className="flex-1 rounded-xl py-2.5 border border-black/15 dark:border-white/15 items-center flex-row justify-center active:opacity-70"
              >
                <Ionicons name="mail-outline" size={17} color={isDark ? '#fff' : '#000'} />
                <Text className="ml-1.5 text-sm font-semibold text-black dark:text-white">Message</Text>
              </Pressable>
              <Pressable
                onPress={() => { }}
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
          <PostsGrid
            posts={posts}
            isDark={isDark}
            onCellPress={(post) =>
              setSelectedPostIndex(posts.findIndex((p) => p.id === post.id))
            }
          />
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

      {/* ─── Edit Profile Modal ─── */}
      <EditProfileModal
        visible={showEditProfile}
        profile={profile}
        token={token}
        isDark={isDark}
        onClose={() => setShowEditProfile(false)}
        onSaved={(updated) => {
          if (updated) setProfile((prev) => ({ ...prev, ...updated }));
        }}
      />

      {/* ─── Followers / Following Modal ─── */}
      <FollowListModal
        visible={followModal === 'followers' || followModal === 'following'}
        type={followModal ?? 'followers'}
        profileId={profile?.id}
        token={token}
        currentUserId={currentUser?.id}
        insets={insets}
        isDark={isDark}
        onClose={() => setFollowModal(null)}
      />

      {/* ─── Posts Feed Modal (all posts, scrolled to tapped index) ─── */}
      <Modal
        visible={selectedPostIndex >= 0}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPostIndex(-1)}
      >
        <View className="flex-1 bg-light dark:bg-dark">
          {/* Modal header */}
          <View
            className="flex-row items-center px-4 bg-light dark:bg-dark border-b border-black/10 dark:border-white/10"
            style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
          >
            <TouchableOpacity onPress={() => setSelectedPostIndex(-1)} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <Text className="ml-3 text-base font-bold text-black dark:text-white">
              {profile?.name || 'Posts'}
            </Text>
          </View>

          {/* Full feed list — starts at the tapped post, scroll freely */}
          <FlatList
            ref={feedListRef}
            data={posts}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <FeedItem item={item} />}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={selectedPostIndex >= 0 ? selectedPostIndex : 0}
            // Required for initialScrollIndex to work reliably on variable-height items:
            // We provide a generous estimate; onScrollToIndexFailed handles edge cases.
            getItemLayout={(_, index) => ({
              length: 520,
              offset: 520 * index,
              index,
            })}
            onScrollToIndexFailed={(info) => {
              // Fallback: wait for list to finish rendering then retry
              feedListRef.current?.scrollToOffset({
                offset: 520 * info.index,
                animated: false,
              });
            }}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        </View>
      </Modal>
    </AppLayout>
  );
}
