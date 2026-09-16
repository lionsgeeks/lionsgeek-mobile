import { View, Text, Pressable, Image } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { resolveAvatarUrl } from '@/components/helpers/helpers';

/**
 * Avatar tile for a single user's story group.
 *
 * Props:
 *   user        – { id, name, avatar }
 *   isOwn       – render the "+" badge and "Your story" label
 *   hasStories  – the user has at least one active story (controls ring presence)
 *   hasUnseen   – at least one of their stories has NOT been viewed by the auth user
 *                  -> gold ring; otherwise grey ring
 *   onPress     – avatar / tile tapped (view stories)
 *   onAddPress  – own-story "+" badge tapped (create story)
 */
export default function StoryItem({
  user,
  isOwn = false,
  hasStories = true,
  hasUnseen = true,
  isCloseFriends = false,
  onPress,
  onAddPress,
  onLongPress,
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const avatarUrl = resolveAvatarUrl(user?.avatar || user?.image);
  const displayName = isOwn ? 'Your story' : (user?.name || 'User');
  const initial = (user?.name || 'U').charAt(0).toUpperCase();

  // Ring colour: gold if unseen, grey if seen, transparent if no stories at all
  // (the "Your story" button when user has not posted anything).
  let ringColor = 'transparent';
  if (hasStories) {
    ringColor = hasUnseen ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)');
  }

  return (
    <View style={{ width: 76, marginRight: 12, alignItems: 'center' }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={
          isOwn
            ? (hasStories ? 'Your story. Tap to view.' : 'Add a story')
            : `${displayName}${hasUnseen ? ', new stories' : ', seen'}`
        }
        className="items-center active:opacity-70"
      >
        <View
          style={{
            width: 72, height: 72, borderRadius: 36,
            padding: 2.5,
            backgroundColor: 'transparent',
            borderWidth: hasStories ? 2.5 : 0,
            borderColor: ringColor,
          }}
        >
          {/* White gap ring */}
          <View
            style={{
              flex: 1, borderRadius: 33,
              backgroundColor: isDark ? '#171717' : '#fafafa',
              padding: 2,
            }}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                defaultSource={require('@/assets/images/icon.png')}
                style={{ width: '100%', height: '100%', borderRadius: 29 }}
              />
            ) : (
              <View
                style={{ flex: 1, borderRadius: 29, alignItems: 'center', justifyContent: 'center' }}
                className="bg-beta/10 dark:bg-beta/40"
              >
                <Text className="font-extrabold text-base text-black/70 dark:text-white/70">
                  {initial}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      {/* "+" badge for own story — separate hit target so it opens create. */}
      {isOwn ? (
        <Pressable
          onPress={onAddPress || onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Add a story"
          style={{
            position: 'absolute', bottom: 22, right: 2,
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: '#ffc801',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2,
            borderColor: isDark ? '#171717' : '#fafafa',
            zIndex: 2,
          }}
        >
          <Ionicons name="add" size={13} color="#000" />
        </Pressable>
      ) : isCloseFriends ? (
        <View
          style={{
            position: 'absolute', bottom: 22, right: 2,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: '#ffc801',
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 2,
            borderColor: isDark ? '#171717' : '#fafafa',
          }}
        >
          <Ionicons name="star" size={9} color="#000" />
        </View>
      ) : null}

      <Text
        numberOfLines={1}
        style={{ marginTop: 6, fontSize: 11, fontWeight: '600', color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.75)', maxWidth: 70, textAlign: 'center' }}
      >
        {displayName}
      </Text>
    </View>
  );
}
