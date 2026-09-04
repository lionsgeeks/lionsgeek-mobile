import { View, Text, Modal, Pressable, Share, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallContext } from '@/context/CallContext';

export default function ProfileOptionsMenu({ visible, onClose, profile, insets, isDark }) {
  const { initiate } = useCallContext();
  const profileId = profile?.id;

  const handleMessage = () => {
    onClose();
    if (profileId) {
      router.push(`/(tabs)/chat/${profileId}`);
    }
  };

  const handleCall = async () => {
    onClose();
    if (!profileId) return;
    try {
      await initiate(profileId);
    } catch {
      Alert.alert('Error', 'Could not start call. Please try again.');
    }
  };

  const handleShare = async () => {
    onClose();
    const name = profile?.name || 'this member';
    try {
      await Share.share({
        message: `Check out ${name} on LionsGeek.`,
      });
    } catch {
      // User dismissed the share sheet.
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/35 justify-end">
        <Pressable
          onPress={() => {}}
          className="bg-light dark:bg-dark rounded-t-3xl px-4 pt-4 pb-6 border-t border-black/10 dark:border-white/10"
          style={{ paddingBottom: insets.bottom + 18 }}
        >
          <View className="items-center mb-3">
            <View className="w-10 h-1.5 rounded-full bg-black/20 dark:bg-white/20" />
          </View>

          <Text className="text-base font-bold text-black dark:text-white mb-3">
            Profile options
          </Text>

          <Pressable
            onPress={handleMessage}
            className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04]"
          >
            <View className="w-9 h-9 rounded-xl bg-alpha/15 items-center justify-center">
              <Ionicons name="mail-outline" size={18} color="#ffc801" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-black dark:text-white">Message</Text>
              <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">
                Open a chat with {profile?.name || 'this member'}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            />
          </Pressable>

          <Pressable
            onPress={handleCall}
            className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] mt-2"
          >
            <View className="w-9 h-9 rounded-xl bg-alpha/15 items-center justify-center">
              <Ionicons name="call-outline" size={18} color="#ffc801" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-black dark:text-white">Voice call</Text>
              <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">
                Start a voice call
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            />
          </Pressable>

          <Pressable
            onPress={handleShare}
            className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] mt-2"
          >
            <View className="w-9 h-9 rounded-xl bg-alpha/15 items-center justify-center">
              <Ionicons name="share-outline" size={18} color="#ffc801" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-black dark:text-white">Share profile</Text>
              <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">
                Send a link to this profile
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
            />
          </Pressable>

          <Pressable onPress={onClose} className="items-center py-3 mt-2">
            <Text className="text-sm font-semibold text-black/60 dark:text-white/60">Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
