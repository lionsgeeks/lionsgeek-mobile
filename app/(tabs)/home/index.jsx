import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useAppContext } from '@/context';
import StoriesTray from './Partials/StoriesTray';
import FeedItem from './Partials/FeedItem';
import CreatePost from './Partials/CreatePost';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import HomeAttendanceReminderBanner from '@/components/training/HomeAttendanceReminderBanner';
import { useScrollTabPadding } from '@/hooks/useScrollTabPadding';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { assignUniqueFeedKeys } from '@/components/helpers/helpers';

const PAGE_SIZE = 5;

function getAvatarUrl(avatar, image) {
  const avatarValue = avatar || image;

  if (!avatarValue) return null;

  if (typeof avatarValue === 'string' && (avatarValue.startsWith('http://') || avatarValue.startsWith('https://'))) {
    return avatarValue;
  }

  if (typeof avatarValue === 'string') {
    if (avatarValue.includes('storage/')) {
      const cleanPath = avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`;
      return `${API.APP_URL}${cleanPath}`;
    }
    return `${API.APP_URL}/storage/img/profile/${avatarValue}`;
  }

  return null;
}

function normalizeFeedPost(post) {
  const userAvatar = post.user?.avatar || post.author?.avatar || post.user_avatar || post.author_avatar;
  const userImage = post.user?.image || post.author?.image || post.user_image || post.author_image;
  const avatarUrl = getAvatarUrl(userAvatar, userImage);

  const normalizedUser = {
    ...(post.user || post.author || {}),
    name: post.user?.name || post.author?.name || post.user_name || post.author_name || 'Unknown',
    avatar: avatarUrl,
    image: userImage,
  };

  let normalizedImage = post.image || post.image_url || post.media?.url || (post.images && post.images[0]);

  if (normalizedImage && typeof normalizedImage === 'string' && !normalizedImage.startsWith('http')) {
    if (normalizedImage.includes('storage/')) {
      const cleanPath = normalizedImage.startsWith('/') ? normalizedImage : `/${normalizedImage}`;
      normalizedImage = `${API.APP_URL}${cleanPath}`;
    } else {
      normalizedImage = `${API.APP_URL}/storage/img/posts/${normalizedImage}`;
    }
  }

  return {
    ...post,
    user: normalizedUser,
    userAvatar: avatarUrl,
    postImage: normalizedImage,
    image: normalizedImage,
  };
}

export default function HomeScreen() {
  const { user, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scrollBottomPadding = useScrollTabPadding(24);
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(null);

  const handleRepost = useCallback(async (post) => {
    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    try {
      const wasReposted = Boolean(post?.isReposted || post?.is_reposted_by_user || post?.reposted);
      const endpoint = wasReposted ? 'mobile/posts/unrepost' : 'mobile/posts/repost';

      const response = await API.post(endpoint, { post_id: post.id }, token);

      if (response?.data) {
        const serverReposted = response?.data?.reposted;
        const serverCount = response?.data?.reposts_count;
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  isReposted: typeof serverReposted === 'boolean' ? serverReposted : !wasReposted,
                  reposted: typeof serverReposted === 'boolean' ? serverReposted : !wasReposted,
                  reposts:
                    typeof serverCount === 'number'
                      ? Math.max(0, serverCount)
                      : Math.max(0, (p.reposts || 0) + (wasReposted ? -1 : 1)),
                  reposted_by: !wasReposted ? user?.name || 'You' : p.reposted_by ?? null,
                }
              : p
          )
        );
      }
    } catch (error) {
      console.error('[HOME] Error reposting:', error);
      Alert.alert('Error', 'Failed to update repost. Please try again.');
    }
  }, [token, user?.name]);

  const fetchFeed = useCallback(
    async ({ append = false, offset = 0 } = {}) => {
      if (!token) {
        setPosts([]);
        setNextOffset(null);
        setLoading(false);
        return;
      }

      const response = await API.getWithAuth(
        `mobile/feed?offset=${offset}&limit=${PAGE_SIZE}`,
        token
      );

      const feedData = response?.data?.feed || response?.data?.posts || [];
      const next = response?.data?.next_offset;
      setNextOffset(typeof next === 'number' ? next : null);

      const feedPosts = assignUniqueFeedKeys(
        feedData.map((post) => ({
          ...normalizeFeedPost(post),
          onRepost: handleRepost,
        }))
      );

      setPosts((prev) => (append ? assignUniqueFeedKeys([...prev, ...feedPosts]) : feedPosts));
    },
    [token, handleRepost]
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setPosts([]);
        setNextOffset(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNextOffset(null);
      try {
        await fetchFeed({ append: false, offset: 0 });
      } catch (error) {
        if (!cancelled) {
          console.error('[HOME] Error fetching feed:', error);
          setPosts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token, fetchFeed]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      setNextOffset(null);
      await fetchFeed({ append: false, offset: 0 });
    } catch (error) {
      console.error('[HOME] Error refreshing feed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [token, fetchFeed]);

  const loadMore = useCallback(async () => {
    if (!token || nextOffset === null || loading || loadingMore) return;

    setLoadingMore(true);
    try {
      await fetchFeed({ append: true, offset: nextOffset });
    } catch (error) {
      console.error('[HOME] Error loading more feed:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [token, nextOffset, loading, loadingMore, fetchFeed]);

  const handlePostCreated = useCallback(
    (newPost) => {
      setPosts((prevPosts) =>
        assignUniqueFeedKeys([
          {
            ...newPost,
            onRepost: handleRepost,
          },
          ...prevPosts,
        ])
      );
    },
    [handleRepost]
  );

  const renderFeedSkeleton = () => (
    <View style={{ paddingTop: 10 }}>
      {Array.from({ length: 4 }).map((_, idx) => (
        <View
          key={idx}
          style={{
            backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
            marginBottom: 8,
            borderTopWidth: 0.5,
            borderBottomWidth: 0.5,
            borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
            paddingBottom: 14,
          }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingTop: 14,
              paddingBottom: 10,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Skeleton width={42} height={42} borderRadius={21} isDark={isDark} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Skeleton width={160} height={12} borderRadius={8} isDark={isDark} />
              <View style={{ height: 8 }} />
              <Skeleton width={90} height={10} borderRadius={8} isDark={isDark} />
            </View>
          </View>
          <Skeleton width="100%" height={360} borderRadius={0} isDark={isDark} />
          <View style={{ paddingHorizontal: 12, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
                <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
                <Skeleton width={28} height={28} borderRadius={14} isDark={isDark} />
              </View>
              <Skeleton width={26} height={26} borderRadius={13} isDark={isDark} />
            </View>
            <View style={{ height: 10 }} />
            <Skeleton width={140} height={12} borderRadius={8} isDark={isDark} />
            <View style={{ height: 10 }} />
            <Skeleton width="92%" height={12} borderRadius={8} isDark={isDark} />
            <View style={{ height: 8 }} />
            <Skeleton width="70%" height={12} borderRadius={8} isDark={isDark} />
          </View>
        </View>
      ))}
    </View>
  );

  const listHeader = (
    <>
      <StoriesTray refreshKey={refreshing ? Date.now() : 0} />
      <View
        style={{
          backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
          marginBottom: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <CreatePost onPostPress={() => {}} onPostCreated={handlePostCreated} />
      </View>
    </>
  );

  const listEmpty = loading ? (
    renderFeedSkeleton()
  ) : (
    <View
      style={{
        backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
        marginHorizontal: 0,
        paddingVertical: 48,
        alignItems: 'center',
      }}
    >
      <Ionicons
        name="document-text-outline"
        size={48}
        color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
      />
      <Text className="text-black/60 dark:text-white/60 text-center mt-4 px-4">
        No posts yet. Be the first to share something!
      </Text>
    </View>
  );

  return (
    <AppLayout showNavbar={true}>
      <HomeAttendanceReminderBanner />
      <FlatList
        data={loading ? [] : posts}
        keyExtractor={(item) => String(item.feedKey ?? item.id)}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: isDark ? '#0f0f0f' : '#e9e5df' }}
        contentContainerStyle={{ paddingBottom: scrollBottomPadding, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffc801" />
        }
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <ActivityIndicator color="#ffc801" />
            </View>
          ) : (
            <View style={{ height: 8 }} />
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item }) => (
          <FeedItem
            item={{
              ...item,
              onRepost: handleRepost,
              onPostDeleted: (postId) => {
                setPosts((prev) => prev.filter((p) => p.id !== postId));
              },
            }}
          />
        )}
      />
    </AppLayout>
  );
}
