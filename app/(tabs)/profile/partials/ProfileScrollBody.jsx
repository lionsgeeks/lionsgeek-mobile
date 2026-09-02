import {
  View, Text, ScrollView, RefreshControl, Image, TouchableOpacity, Pressable, Linking, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Rolegard from '@/components/Rolegard';
import HighlightsRow from '../../stories/Partials/HighlightsRow';
import OnlineBadge from './OnlineBadge';
import StatColumn from './StatColumn';
import AboutCard from './AboutCard';
import ExperienceCard from './ExperienceCard';
import EducationCard from './EducationCard';
import ProfileTabBar from './ProfileTabBar';
import PostsGridTab from './PostsGridTab';
import RepostsGridTab from './RepostsGridTab';
import { iconForSocialTitle } from './_helpers';
import { useScrollTabPadding } from '@/hooks/useScrollTabPadding';

function isHttpOrHttpsUrl(url) {
  if (typeof url !== 'string' || url.trim() === '') {
    return false;
  }

  try {
    const scheme = new URL(url.trim()).protocol.replace(':', '').toLowerCase();
    return scheme === 'http' || scheme === 'https';
  } catch {
    return false;
  }
}

export default function ProfileScrollBody(props) {
  const scrollBottomPadding = useScrollTabPadding(24);
  const {
    profile, isOwnProfile, isDark, refreshing, onRefresh,
    coverImageUrl, profileImageUrl, pickAndUploadCover, coverUploading,
    avatarUploading, setShowAvatarOptions, setShowAvatarViewer,
    originalPostsCount, followersCount, setFollowModal, socialLinks,
    lastExperienceLocation, speciality, handleFollowToggle, followLoading,
    isFollowing, openCreateMenu, setShowEditProfile, activeTab, setActiveTab,
    originalPosts, postsLoading, setSelectedPostIndex, token, setProfile,
    repostedPosts, repostsLoading, setSelectedRepostIndex,
    savedPosts, savedPostsLoading, setSelectedSavedPostIndex,
    onMessagePress, onOpenOptions,
  } = props;

  return (
    <ScrollView
      className="flex-1 bg-light dark:bg-dark"
      showsVerticalScrollIndicator={false}
      bounces
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
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
      <View className="flex-row items-start pl-4 -mt-11 mb-3">
        {/* Avatar */}
        <View className="relative">
          <Pressable
            onPress={() => {
              // Own profile: show options (view / change). Other profile: just view.
              if (isOwnProfile) setShowAvatarOptions(true);
              else setShowAvatarViewer(true);
            }}
            disabled={avatarUploading}
            className="rounded-full border-4 border-light dark:border-dark overflow-hidden"
            style={{ width: 90, height: 90, opacity: avatarUploading ? 0.75 : 1 }}
            accessibilityRole="button"
            accessibilityLabel={isOwnProfile ? 'Profile picture options' : 'View profile picture'}
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

            {/* Uploading overlay */}
            {avatarUploading && (
              <View className="absolute inset-0 items-center justify-center bg-black/35">
                <ActivityIndicator size="small" color="#ffc801" />
              </View>
            )}
          </Pressable>

          {/* Own profile: show edit hint badge. Other users: show online dot. */}
          {isOwnProfile ? (
            <View className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-alpha border-2 border-light dark:border-dark items-center justify-center">
              <Ionicons name="camera" size={16} color="#212529" />
            </View>
          ) : (
            <OnlineBadge lastOnline={profile?.last_online} />
          )}
        </View>

        {/* Stats */}
        <View className="flex-1 flex-row justify-around mt-14 ml-5">
          <StatColumn label="Posts" value={originalPostsCount} />
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
                    if (!isHttpOrHttpsUrl(url)) {
                      return;
                    }
                    try {
                      await Linking.openURL(url);
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
        {/* {isOwnProfile && profile?.roles && profile.roles.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-1.5">
              {profile.roles.map((role, idx) => (
                <View key={idx} className="px-2.5 py-0.5 rounded-full bg-alpha">
                  <Text className="text-xs font-semibold text-beta capitalize">{role}</Text>
                </View>
              ))}
            </View>
          )} */}

        {/* Status / promo / email */}
        {profile?.status ? (
          <Text className="text-sm text-black/70 dark:text-white/70 mt-1.5 leading-5">
            {profile.status}
          </Text>
        ) : null}
        {profile?.promo ? (
          <Text className="text-sm text-black/50 dark:text-dark_gray0 mt-0.5">
            Promo {profile.promo}
          </Text>
        ) : null}
        {/* {isOwnProfile && profile?.email ? (
            <Text className="text-sm text-alpha mt-0.5">{profile.email}</Text>
          ) : null} */}
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
              onPress={openCreateMenu}
              className="px-4 py-2.5 rounded-xl border border-black/15 dark:border-white/15 items-center justify-center active:opacity-70"
            >
              <Ionicons name="add-outline" size={20} color={isDark ? '#fff' : '#000'} />
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
              onPress={onMessagePress}
              className="flex-1 rounded-xl py-2.5 border border-black/15 dark:border-white/15 items-center flex-row justify-center active:opacity-70"
            >
              <Ionicons name="mail-outline" size={17} color={isDark ? '#fff' : '#000'} />
              <Text className="ml-1.5 text-sm font-semibold text-black dark:text-white">Message</Text>
            </Pressable>
            <Pressable
              onPress={onOpenOptions}
              className="px-4 py-2.5 rounded-xl border border-black/15 dark:border-white/15 items-center justify-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="More profile options"
            >
              <Ionicons name="chevron-down" size={18} color={isDark ? '#fff' : '#000'} />
            </Pressable>
          </>
        )}
      </View>

      {/* ─── Admin Details (Rolegard) ─── */}
      <Rolegard authorized={['admin', 'coach']}>
        <View className="mx-4 mb-5 rounded-xl bg-beta/5 dark:bg-dark_gray p-4 border border-black/8 dark:border-white/8">
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

      {/* ─── Story Highlights ─── */}
      {profile?.id ? (
        <HighlightsRow
          userId={profile.id}
          isOwnProfile={isOwnProfile}
          isDark={isDark}
          refreshKey={refreshing ? Date.now() : 0}
        />
      ) : null}

      {/* ─── Profile Tabs ─── */}
      <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />

      {/* Tab 1 — Posts grid (Instagram-style) */}
      {activeTab === 0 && (
        <PostsGridTab
          posts={originalPosts}
          postsLoading={postsLoading}
          isDark={isDark}
          emptyLabel="No posts yet"
          emptyIcon="images-outline"
          onPostPress={(post) =>
            setSelectedPostIndex(originalPosts.findIndex((p) => p.id === post.id))
          }
        />
      )}

      {/* Tab 2 — Resume: About + Experience + Education */}
      {activeTab === 1 && (
        <View className="pt-3">
          <AboutCard profile={profile} isDark={isDark} />

          <ExperienceCard
            profile={profile}
            isDark={isDark}
            isOwnProfile={isOwnProfile}
            token={token}
            onExperienceAdded={(exp) => {
              setProfile((prev) => {
                if (!prev) return prev;
                const current = Array.isArray(prev.experiences) ? prev.experiences : [];
                return { ...prev, experiences: [exp, ...current] };
              });
            }}
            onExperienceUpdated={(updated) => {
              setProfile((prev) => {
                if (!prev) return prev;
                const current = Array.isArray(prev.experiences) ? prev.experiences : [];
                return {
                  ...prev,
                  experiences: current.map((e) =>
                    String(e.id) === String(updated.id) ? { ...e, ...updated } : e
                  ),
                };
              });
            }}
            onExperienceDeleted={(id) => {
              setProfile((prev) => {
                if (!prev) return prev;
                const current = Array.isArray(prev.experiences) ? prev.experiences : [];
                return {
                  ...prev,
                  experiences: current.filter((e) => String(e.id) !== String(id)),
                };
              });
            }}
          />

          <EducationCard profile={profile} isDark={isDark} />
        </View>
      )}

      {/* Tab 3 — Reposts */}
      {activeTab === 2 && (
        <RepostsGridTab
          reposts={repostedPosts}
          loading={repostsLoading}
          isDark={isDark}
          onPostPress={(post) =>
            setSelectedRepostIndex(repostedPosts.findIndex((p) => p.id === post.id))
          }
        />
      )}

      {/* Tab 4 — Saved posts */}
      {activeTab === 3 && (
        <PostsGridTab
          posts={savedPosts}
          postsLoading={savedPostsLoading}
          isDark={isDark}
          emptyLabel="No saved posts yet"
          emptyIcon="bookmark-outline"
          onPostPress={(post) =>
            setSelectedSavedPostIndex(savedPosts.findIndex((p) => p.id === post.id))
          }
        />
      )}

    </ScrollView>
  );
}
