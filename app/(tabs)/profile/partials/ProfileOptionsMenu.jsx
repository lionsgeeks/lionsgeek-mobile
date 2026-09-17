import { useState } from 'react';
import { View, Text, Modal, Pressable, Share, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';

export default function ProfileOptionsMenu({
  visible,
  onClose,
  profile,
  insets,
  isDark,
  onUserBlocked,
}) {
  const { token, user } = useAppContext();
  const profileId = profile?.id;
  const isOwnProfile = user?.id != null && profileId != null && Number(user.id) === Number(profileId);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const handleMessage = () => {
    onClose();
    if (profileId) {
      router.push(`/(tabs)/chat/${profileId}`);
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

  const handleOpenReport = () => {
    onClose();
    setShowReportModal(true);
  };

  const handleSubmitReport = async (reason) => {
    if (!token || !profileId) {
      Alert.alert('Error', 'Authentication required');
      return;
    }
    if (reportSubmitting) return;

    setReportSubmitting(true);
    try {
      await API.postWithAuth(
        `mobile/users/${profileId}/report`,
        { reason: String(reason || '').trim() },
        token
      );
      setShowReportModal(false);
      Alert.alert('Reported', 'Thanks. Our team will review this profile.');
    } catch (error) {
      const data = error?.response?.data;
      const msg =
        (data && typeof data === 'object' && (data.message || data.error)) ||
        (typeof data === 'string' ? data : null) ||
        error?.message ||
        'Failed to report this user. Please try again.';
      Alert.alert('Error', String(msg));
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleBlock = () => {
    onClose();
    if (!profileId || !token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    const name = profile?.name || 'this member';
    Alert.alert(
      'Block user',
      `Block ${name}? You will no longer see their posts in your feed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (blockSubmitting) return;
            setBlockSubmitting(true);
            try {
              await API.postWithAuth(`mobile/users/${profileId}/block`, {}, token);
              onUserBlocked?.(Number(profileId));
              Alert.alert('Blocked', `${name} has been blocked.`);
            } catch (error) {
              const data = error?.response?.data;
              const msg =
                (data && typeof data === 'object' && (data.message || data.error)) ||
                (typeof data === 'string' ? data : null) ||
                error?.message ||
                'Failed to block this user. Please try again.';
              Alert.alert('Error', String(msg));
            } finally {
              setBlockSubmitting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <>
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

            {!isOwnProfile ? (
              <>
                <Pressable
                  onPress={handleOpenReport}
                  className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] mt-2"
                >
                  <View className="w-9 h-9 rounded-xl bg-red-500/15 items-center justify-center">
                    <Ionicons name="flag-outline" size={18} color="#ef4444" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-red-500">Report user</Text>
                    <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">
                      Flag abusive or objectionable behavior
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={handleBlock}
                  className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.04] mt-2"
                >
                  <View className="w-9 h-9 rounded-xl bg-red-500/15 items-center justify-center">
                    <Ionicons name="ban-outline" size={18} color="#ef4444" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-red-500">Block user</Text>
                    <Text className="text-xs text-black/45 dark:text-white/45 mt-0.5">
                      Hide their posts from your feed
                    </Text>
                  </View>
                </Pressable>
              </>
            ) : null}

            <Pressable onPress={onClose} className="items-center py-3 mt-2">
              <Text className="text-sm font-semibold text-black/60 dark:text-white/60">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ReportReasonModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleSubmitReport}
        submitting={reportSubmitting}
        title="Report user"
        isDark={isDark}
      />
    </>
  );
}
