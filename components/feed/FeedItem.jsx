import { useMemo, useState } from 'react';
import { Alert, Dimensions, Modal, ScrollView, View, Text, Image, Pressable, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';
import CommentsModal from '@/components/feed/CommentsModal';
import LikesModal from '@/components/feed/LikesModal';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

const CAPTION_PREVIEW_LENGTH = 60;

function resolveAvatarUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.includes('storage/')) {
    const cleanPath = value.startsWith('/') ? value : `/${value}`;
    return `${API.APP_URL}${cleanPath}`;
  }
  return `${API.APP_URL}/storage/img/profile/${value}`;
}

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  if (weeks > 4) return date.toLocaleDateString();
  if (weeks > 0) return `${weeks}w`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'just now';
}

/**
 * Renders a fully-tappable caption block.
 * - Short captions (≤ CAPTION_PREVIEW_LENGTH chars) → plain text, no toggle.
 * - Long captions → shows preview + "... see more" / full text + " see less".
 * - Tapping anywhere on the text block toggles expanded state.
 */
function Caption({ name, text, textSize = 14, lineHeight = 22, textColor, mutedColor }) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  const isLong = text.length > CAPTION_PREVIEW_LENGTH;

  const displayedText = isLong && !expanded
    ? text.slice(0, CAPTION_PREVIEW_LENGTH).trimEnd()
    : text;

  return (
    <Pressable onPress={() => isLong && setExpanded(p => !p)} className="active:opacity-75">
      <Text style={{ fontSize: textSize, lineHeight, color: textColor }}>
        <Text style={{ fontWeight: '800', color: textColor }}>{name} </Text>
        {displayedText}
        {isLong && !expanded ? (
          <Text style={{ color: mutedColor, fontWeight: '700' }}>{'... '}
            <Text style={{ color: mutedColor, fontWeight: '700' }}>see more</Text>
          </Text>
        ) : null}
        {isLong && expanded ? (
          <Text style={{ color: mutedColor, fontWeight: '700' }}> see less</Text>
        ) : null}
      </Text>
    </Pressable>
  );
}

function PostImage({ uri, width, isDark, onDoubleTap }) {
  const heartScale = useSharedValue(0.25);
  const heartOpacity = useSharedValue(0);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ scale: heartScale.value }],
  }));

  const doubleTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDelay(260)
        .onStart(() => {
          if (onDoubleTap) runOnJS(onDoubleTap)();
          heartOpacity.value = 1;
          heartScale.value = 0.25;
          heartScale.value = withSpring(1, { damping: 10, stiffness: 220 });
          heartOpacity.value = withDelay(450, withTiming(0, { duration: 220 }));
        }),
    [onDoubleTap]
  );

  return (
    <GestureDetector gesture={doubleTapGesture}>
      <View style={{ width, aspectRatio: 1, backgroundColor: isDark ? '#1f1f1f' : '#f0f0f0' }}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />

        {/* Instagram-like heart burst */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            },
            heartStyle,
          ]}
        >
          <Ionicons name="heart" size={120} color="#ffc801" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default function FeedItem({ item, onPress }) {
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [liked, setLiked] = useState(Boolean(item.is_liked_by_user));
  const [likeCount, setLikeCount] = useState(item.likes || 0);
  const [saved, setSaved] = useState(false);
  const [commentCount, setCommentCount] = useState(item.comments || 0);
  const [showComments, setShowComments] = useState(false);
  const [showLikes, setShowLikes] = useState(false);
  const [showPostMenu, setShowPostMenu] = useState(false);

  const avatarUrl = resolveAvatarUrl(
    item.user?.avatar || item.userAvatar || item.user?.image
  );
  const mediaUrls = useMemo(() => {
    if (Array.isArray(item.images) && item.images.length > 0) return item.images.filter(Boolean);
    if (item.postImage) return [item.postImage];
    return [];
  }, [item.images, item.postImage]);
  const hasMedia = mediaUrls.length > 0;
  const isCarousel = mediaUrls.length > 1;
  const [carouselIndex, setCarouselIndex] = useState(0);

  const screenWidth = Dimensions.get('window').width;
  const displayName = item.user?.name || 'Unknown';
  const caption = item.description || item.content || '';
  const repostCount = item.reposts || 0;
  const isOwner = (user?.id && item.user?.id) ? Number(user.id) === Number(item.user.id) : false;

  const handleLike = async () => {
    // Optimistic update — flip immediately so UI feels instant
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);

    try {
      const response = await API.post(`mobile/posts/like/${item.id}`, {}, token);
      // Sync with server truth
      if (response?.data) {
        setLiked(response.data.liked);
        setLikeCount(response.data.likes_count);
      }
    } catch {
      // Revert optimistic update on failure
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
    }
  };

  const handleDoubleTapLike = () => {
    // Instagram behavior: double tap only LIKES (doesn't unlike)
    if (!liked) handleLike();
  };

  const iconColor = isDark ? '#e5e5e5' : '#262626';
  const textColor = isDark ? '#f5f5f5' : '#111111';
  const mutedColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';

  const handleDeletePost = () => {
    setShowPostMenu(false);
    Alert.alert(
      'Delete post?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.remove(`mobile/posts/${item.id}`, token);
              if (typeof item.onPostDeleted === 'function') {
                item.onPostDeleted(item.id);
              }
            } catch (_error) {
              Alert.alert('Error', 'Failed to delete the post. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleEditPost = () => {
    setShowPostMenu(false);
    router.push(`/posts/edit/${item.id}`);
  };

  return (
    <View
      style={{
        backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
        marginBottom: 8,
        // Subtle top/bottom border for the card edge
        borderTopWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: isDark ? '#2e2e2e' : '#ddd8d0',
      }}
    >
      {/* ── Repost banner ── */}
      {item.reposted ? (
        <View className="flex-row items-center px-4 pt-3 pb-1">
          <Ionicons name="repeat" size={14} color={mutedColor} />
          <Text style={{ color: mutedColor }} className="text-xs ml-1 font-semibold">
            {item.reposted_by || 'Someone'} reposted
          </Text>
        </View>
      ) : null}

      {/* ── Header ── */}
      <View className="flex-row items-center px-3 py-3">
        <Pressable onPress={onPress} className="flex-row items-center flex-1 active:opacity-80">
          {/* Avatar with gold ring */}
          <View
            style={{
              width: 42, height: 42, borderRadius: 21,
              padding: 2,
              backgroundColor: '#ffc801',
              marginRight: 10,
            }}
          >
            <View
              style={{
                flex: 1, borderRadius: 19,
                backgroundColor: isDark ? '#171717' : '#fafafa',
                padding: 1.5,
              }}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  defaultSource={require('@/assets/images/icon.png')}
                  style={{ width: '100%', height: '100%', borderRadius: 18 }}
                />
              ) : (
                <View
                  style={{ flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                  className="bg-beta/10 dark:bg-beta/40"
                >
                  <Text className="text-sm font-extrabold text-black/70 dark:text-white/70">
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Name + time */}
          <View className="flex-1">
            <Text className="font-bold text-[14px] text-black dark:text-white" numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={{ color: mutedColor }} className="text-[11px]">
              {formatTime(item.created_at)}
            </Text>
          </View>
        </Pressable>

        {isOwner ? (
          <TouchableOpacity
            onPress={() => setShowPostMenu(true)}
            className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={iconColor} />
          </TouchableOpacity>
        ) : (
          <View className="h-8 w-8" />
        )}
      </View>

      {/* ── Caption above image (text-only posts) ── */}
      {!hasMedia && caption ? (
        <View className="px-4 pb-3">
          <Caption
            name={displayName}
            text={caption}
            textSize={14}
            lineHeight={22}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        </View>
      ) : null}

      {/* ── Media (edge-to-edge) ── */}
      {hasMedia ? (
        <View style={{ width: '100%', backgroundColor: isDark ? '#1f1f1f' : '#f0f0f0' }}>
          {isCarousel ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const nextIndex = Math.round(x / screenWidth);
                  if (nextIndex !== carouselIndex) setCarouselIndex(nextIndex);
                }}
                scrollEventThrottle={16}
              >
                {mediaUrls.map((uri, idx) => (
                  <PostImage
                    key={`${uri}-${idx}`}
                    uri={uri}
                    width={screenWidth}
                    isDark={isDark}
                    onDoubleTap={handleDoubleTapLike}
                  />
                ))}
              </ScrollView>

              {/* Counter (top-right) */}
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                  {carouselIndex + 1}/{mediaUrls.length}
                </Text>
              </View>
            </View>
          ) : (
            <PostImage
              uri={mediaUrls[0]}
              width="100%"
              isDark={isDark}
              onDoubleTap={handleDoubleTapLike}
            />
          )}
        </View>
      ) : null}

      {/* Carousel dots (between media and actions) */}
      {isCarousel ? (
        <View
          style={{
            paddingTop: 10,
            paddingBottom: 6,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {mediaUrls.map((_, idx) => {
            const active = idx === carouselIndex;
            return (
              <View
                key={idx}
                style={{
                  width: active ? 7 : 6,
                  height: active ? 7 : 6,
                  borderRadius: 10,
                  backgroundColor: active ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'),
                }}
              />
            );
          })}
        </View>
      ) : null}

      {/* ── Action bar ── */}
      <View className="px-3 pb-1">
        {/* <View
          style={{
            height: 0.5,
            backgroundColor: isDark ? '#2e2e2e' : '#ddd8d0',
            marginBottom: 8,
          }}
        /> */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <TouchableOpacity
              onPress={handleLike}
              style={{
                width: 40, height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                // backgroundColor: liked ? 'rgba(255,200,1,0.15)' : 'transparent',
              }}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={26}
                color={liked ? '#ffc801' : iconColor}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowComments(true)} className="active:opacity-60">
              <Ionicons name="chatbubble-outline" size={24} color={iconColor} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { if (item.onRepost) item.onRepost(item); }}
              className="active:opacity-60"
            >
              <Ionicons
                name={item.isReposted ? 'repeat' : 'paper-plane-outline'}
                size={24}
                color={item.isReposted ? '#ffc801' : iconColor}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => setSaved(p => !p)} className="active:opacity-60">
            <Ionicons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={saved ? '#ffc801' : iconColor}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Like count ── */}
      {likeCount > 0 ? (
        <Pressable onPress={() => setShowLikes(true)} className="px-4 pb-1 active:opacity-60">
          <Text className="font-extrabold text-[13px] text-black dark:text-white">
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </Text>
        </Pressable>
      ) : null}

      {/* ── Caption below image (media posts) ── */}
      {hasMedia && caption ? (
        <View className="px-4 pb-1">
          <Caption
            name={displayName}
            text={caption}
            textSize={13}
            lineHeight={20}
            textColor={textColor}
            mutedColor={mutedColor}
          />
        </View>
      ) : null}

      {/* ── Comments + reposts info ── */}
      {(commentCount > 0 || repostCount > 0) ? (
        <Pressable onPress={() => setShowComments(true)} className="px-4 pb-1 active:opacity-60">
          <Text style={{ color: mutedColor }} className="text-[12px]">
            {commentCount > 0 ? `View all ${commentCount} comment${commentCount > 1 ? 's' : ''}` : ''}
            {commentCount > 0 && repostCount > 0 ? '  •  ' : ''}
            {repostCount > 0 ? `${repostCount} repost${repostCount > 1 ? 's' : ''}` : ''}
          </Text>
        </Pressable>
      ) : null}

      <View className="pb-3" />

      {/* ── Comments modal ── */}
      <CommentsModal
        visible={showComments}
        postId={item.id}
        postAuthorName={displayName}
        onClose={() => setShowComments(false)}
        onCommentCountChange={(change) => {
          // change can be a delta number OR { set: number } for server-truth sync
          if (typeof change === 'number') {
            if (Number.isNaN(change)) return;
            setCommentCount((c) => Math.max(0, c + change));
            return;
          }
          if (change && typeof change === 'object' && typeof change.set === 'number') {
            setCommentCount(Math.max(0, change.set));
          }
        }}
      />

      <LikesModal
        visible={showLikes}
        postId={item.id}
        onClose={() => setShowLikes(false)}
      />

      {/* Post menu (owner-only) */}
      <Modal
        transparent
        animationType="fade"
        visible={showPostMenu}
        onRequestClose={() => setShowPostMenu(false)}
      >
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setShowPostMenu(false)} />
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: 24,
            backgroundColor: isDark ? '#1c1c1c' : '#ffffff',
            borderRadius: 16,
            borderWidth: 0.5,
            borderColor: isDark ? '#2e2e2e' : '#e8e5e0',
            overflow: 'hidden',
          }}
        >
          <Pressable
            onPress={handleEditPost}
            style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Ionicons name="pencil" size={18} color={textColor} />
            <Text style={{ color: textColor, fontWeight: '800' }}>Edit</Text>
          </Pressable>
          <View style={{ height: 0.5, backgroundColor: isDark ? '#2e2e2e' : '#e8e5e0' }} />
          <Pressable
            onPress={handleDeletePost}
            style={{ paddingVertical: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Ionicons name="trash" size={18} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontWeight: '900' }}>Delete</Text>
          </Pressable>
          <View style={{ height: 8, backgroundColor: 'transparent' }} />
          <Pressable onPress={() => setShowPostMenu(false)} style={{ paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' }}>
            <Text style={{ color: mutedColor, fontWeight: '800' }}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}
