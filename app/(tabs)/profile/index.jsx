import { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Modal,
    StatusBar,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AppLayout from '@/components/layout/AppLayout';
import CreatePost from '../home/Partials/CreatePost';
import EditProfileModal from './_components/EditProfileModal';
import ExperienceFormModal from './_components/ExperienceFormModal';
import EducationFormModal from './_components/EducationFormModal';
import {
    resolveAvatarUrl,
    resolvePostMediaUrl,
    resolveCoverUrl,
    parseSavedPostsFromApiResponse,
    normalizeSavedPostsList,
} from '@/components/helpers/helpers';
import ProfileSkeleton from './partials/ProfileSkeleton';
import ProfileTopBar from './partials/ProfileTopBar';
import ProfileScrollBody from './partials/ProfileScrollBody';
import ProfileCreateMenu from './partials/ProfileCreateMenu';
import ProfileOptionsMenu from './partials/ProfileOptionsMenu';
import AvatarOptionsModal from './partials/AvatarOptionsModal';
import AvatarViewerModal from './partials/AvatarViewerModal';
import PostFeedModal from './partials/PostFeedModal';
import RepostsFeedModal from './partials/RepostsFeedModal';
import SavedPostsFeedModal from './partials/SavedPostsFeedModal';
import FollowListModal from './partials/FollowListModal';
import {
    getLastExperience,
    normalizeSocialLinks,
    tryFetchFirstList,
} from './partials/_helpers';
import { isRepostPost } from './partials/RepostsGridTab';

export default function ProfileScreen() {
    const { user: currentUser, token, saveAuth } = useAppContext();
    const { userId, id } = useLocalSearchParams();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [coverUploading, setCoverUploading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [posts, setPosts] = useState([]);
    const [postsLoading, setPostsLoading] = useState(false);
    const [reposts, setReposts] = useState([]);
    const [repostsLoading, setRepostsLoading] = useState(false);
    const [savedPosts, setSavedPosts] = useState([]);
    const [savedPostsLoading, setSavedPostsLoading] = useState(false);
    const [selectedPostIndex, setSelectedPostIndex] = useState(-1);
    const [selectedRepostIndex, setSelectedRepostIndex] = useState(-1);
    const [selectedSavedPostIndex, setSelectedSavedPostIndex] = useState(-1);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [showCreateMenu, setShowCreateMenu] = useState(false);
    const [showProfileOptions, setShowProfileOptions] = useState(false);
    const [showCreateEducation, setShowCreateEducation] = useState(false);
    const [showCreateExperience, setShowCreateExperience] = useState(false);
    const [followModal, setFollowModal] = useState(null); // 'followers' | 'following' | null
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followLoading, setFollowLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [socialLinks, setSocialLinks] = useState([]);
    const [showAvatarOptions, setShowAvatarOptions] = useState(false);
    const [showAvatarViewer, setShowAvatarViewer] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const feedListRef = useRef(null);
    const repostFeedListRef = useRef(null);

    const insets = useSafeAreaInsets();

    const rawUserId = userId ?? id;
    const resolvedUserId = (() => {
        const value = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
        if (value == null || value === '' || value === 'undefined') return undefined;
        return String(value).trim() || undefined;
    })();
    const isOwnProfile = !resolvedUserId || resolvedUserId === currentUser?.id?.toString();

    useEffect(() => {
        setLoading(true);
        setProfile(null);
        setPosts([]);
        setSavedPosts([]);
        setSocialLinks([]);
        setActiveTab(0);
        setSelectedPostIndex(-1);
        setSelectedRepostIndex(-1);
        setSelectedSavedPostIndex(-1);
    }, [resolvedUserId]);

    const loadProfile = useCallback(async () => {
        if (!token && !isOwnProfile) return;
        if (isOwnProfile && !token && !currentUser) return;

        try {
            if (isOwnProfile) {
                if (!token) { setProfile(currentUser); return; }
                const res = await API.getWithAuth('mobile/profile', token);
                const next = res?.data || currentUser;
                setProfile(next);
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
            // Prefer backend endpoints that return a user's posts directly.
            // Fallback to filtering `mobile/feed` only if needed.
            const directCandidates = [
                `mobile/profile/${profileId}/posts`,
                `mobile/users/${profileId}/posts`,
                `mobile/posts/user/${profileId}`,
                `mobile/posts?user_id=${profileId}`,
                `mobile/posts?userId=${profileId}`,
            ];

            let list = await tryFetchFirstList({ token, endpoints: directCandidates });
            if (!Array.isArray(list) || list.length === 0) {
                const res = await API.getWithAuth('mobile/feed', token);
                list = Array.isArray(res?.data?.feed ?? res?.data?.posts)
                    ? (res?.data?.feed ?? res?.data?.posts)
                    : [];
            }

            const normalized = list
                .filter((post) => {
                    const pid = post?.user?.id ?? post?.author?.id ?? post?.user_id ?? post?.userId;
                    return pid != null && Number(pid) === Number(profileId);
                })
                .map((post) => {
                    const body =
                        post?.body ??
                        post?.content ??
                        post?.text ??
                        post?.caption ??
                        post?.description ??
                        post?.message ??
                        post?.post_body ??
                        post?.postBody ??
                        null;
                    const userAvatar = post.user?.avatar || post.author?.avatar || post.user_avatar || post.author_avatar;
                    const userImage = post.user?.image || post.author?.image || post.user_image || post.author_image;
                    const avatarUrl = resolveAvatarUrl(userAvatar || userImage);
                    const mediaUrl = resolvePostMediaUrl(post);
                    return {
                        ...post,
                        body,
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

    const loadReposts = useCallback(async (profileId, profileName) => {
        if (!token || !profileId) return;

        setRepostsLoading(true);
        try {
            const repostCandidates = [
                `mobile/profile/${profileId}/reposts`,
                `mobile/users/${profileId}/reposts`,
                `mobile/posts/reposts?user_id=${profileId}`,
                `mobile/posts/reposts?userId=${profileId}`,
            ];

            let list = await tryFetchFirstList({ token, endpoints: repostCandidates });

            // Fallback: if API doesn't have repost endpoints, extract repost entries from general feed.
            if (!Array.isArray(list) || list.length === 0) {
                const res = await API.getWithAuth('mobile/feed', token);
                const feedList = Array.isArray(res?.data?.feed ?? res?.data?.posts)
                    ? (res?.data?.feed ?? res?.data?.posts)
                    : [];

                list = feedList.filter((post) => {
                    const pid = post?.user?.id ?? post?.author?.id ?? post?.user_id ?? post?.userId;
                    return pid != null && Number(pid) === Number(profileId) && isRepostPost(post);
                });
            }

            const getRepostSource = (post) => {
                const candidates = [
                    post?.repost_of,
                    post?.repostOf,
                    post?.original_post,
                    post?.originalPost,
                    post?.interaction_post,
                    post?.interactionPost,
                    post?.post, // some APIs wrap the original post here
                ];
                return candidates.find((c) => c && typeof c === 'object') ?? null;
            };

            const normalized = (Array.isArray(list) ? list : [])
                .filter((post) => isRepostPost(post))
                .map((post) => {
                    const source = getRepostSource(post) ?? post;

                    const originalId =
                        source?.id ??
                        source?.post_id ??
                        source?.postId ??
                        post?.interaction_post_id ??
                        post?.interactionPostId ??
                        post?.repost_of_post_id ??
                        post?.repostOfPostId ??
                        post?.id ??
                        null;

                    const resolveImages = (imagesLike) => {
                        if (!Array.isArray(imagesLike)) return [];
                        return imagesLike
                            .map((img) => {
                                if (!img) return null;
                                if (typeof img === 'string') return resolvePostMediaUrl(img);
                                if (typeof img === 'object') {
                                    return resolvePostMediaUrl(
                                        img?.url ?? img?.uri ?? img?.path ?? img?.image ?? img?.image_url ?? img?.src ?? null
                                    );
                                }
                                return null;
                            })
                            .filter(Boolean);
                    };

                    const body =
                        source?.body ??
                        source?.content ??
                        source?.text ??
                        source?.caption ??
                        source?.description ??
                        source?.message ??
                        source?.post_body ??
                        source?.postBody ??
                        null;

                    const originalUserAvatar =
                        source?.user?.avatar || source?.author?.avatar || source?.user_avatar || source?.author_avatar;
                    const originalUserImage =
                        source?.user?.image || source?.author?.image || source?.user_image || source?.author_image;
                    const originalAvatarUrl = resolveAvatarUrl(originalUserAvatar || originalUserImage);

                    const resolvedImages = resolveImages(source?.images);
                    const mediaUrl = resolvedImages?.[0] ?? resolvePostMediaUrl(source);
                    const repostedBy =
                        post?.user?.name ||
                        post?.author?.name ||
                        post?.user_name ||
                        post?.author_name ||
                        profileName ||
                        'Someone';

                    return {
                        ...post,
                        // Keep repost entry id for stable keys / debugging
                        repost_entry_id: post?.id ?? null,
                        // Treat the item as the ORIGINAL post for interactions (like/comment/share)
                        id: originalId ?? post?.id,
                        // Preserve repost timestamp separately (the API "repost entry" time)
                        repost_created_at: post?.created_at ?? post?.repost_created_at ?? null,
                        // Display ORIGINAL post time in UI (under original author name)
                        created_at: source?.created_at ?? post?.created_at ?? null,
                        // Make sure the UI shows the ORIGINAL post content (tile + feed)
                        body,
                        description: source?.description ?? source?.content ?? post?.description ?? post?.content ?? null,
                        content: source?.content ?? source?.description ?? post?.content ?? post?.description ?? null,
                        // Force media into the same "array of absolute URL strings" shape FeedItem expects,
                        // otherwise double-tap gestures & rendering can break.
                        images: resolvedImages.length > 0 ? resolvedImages : [],
                        postImage: mediaUrl,
                        image: mediaUrl,

                        // Counts should match ORIGINAL post
                        likes:
                            source?.likes ??
                            source?.likes_count ??
                            source?.likesCount ??
                            post?.likes ??
                            post?.likes_count ??
                            post?.likesCount ??
                            0,
                        comments:
                            source?.comments ??
                            source?.comments_count ??
                            source?.commentsCount ??
                            post?.comments ??
                            post?.comments_count ??
                            post?.commentsCount ??
                            0,
                        reposts:
                            source?.reposts ??
                            source?.reposts_count ??
                            source?.repostsCount ??
                            post?.reposts ??
                            post?.reposts_count ??
                            post?.repostsCount ??
                            0,
                        is_liked_by_user:
                            source?.is_liked_by_user ??
                            source?.isLikedByUser ??
                            post?.is_liked_by_user ??
                            post?.isLikedByUser ??
                            false,

                        // Keep the ORIGINAL author on the post header
                        user: {
                            ...(source.user || source.author || {}),
                            id:
                                source?.user?.id ||
                                source?.author?.id ||
                                source?.user_id ||
                                source?.userId ||
                                post?.user?.id ||
                                post?.author?.id ||
                                post?.user_id ||
                                post?.userId,
                            name:
                                source?.user?.name ||
                                source?.author?.name ||
                                source?.user_name ||
                                source?.author_name ||
                                'Unknown',
                            avatar: originalAvatarUrl,
                            image: originalUserImage,
                        },
                        userAvatar: originalAvatarUrl,

                        // Repost banner
                        reposted: true,
                        reposted_by: post?.reposted_by || post?.repostedBy || repostedBy,

                        // Preserve original source object for share payloads / future features
                        repost_of: source,
                    };
                });

            setReposts(normalized);
        } catch (err) {
            console.error('[PROFILE] fetch reposts error:', err);
            setReposts([]);
        } finally {
            setRepostsLoading(false);
        }
    }, [token]);

    const loadSavedPosts = useCallback(async () => {
        if (!token) return;

        setSavedPostsLoading(true);
        try {
            // Canonical endpoint (implemented in backend): GET /api/mobile/posts/saved
            const res = await API.getWithAuth('mobile/posts/saved', token);
            const list = parseSavedPostsFromApiResponse(res);
            setSavedPosts(normalizeSavedPostsList(list));
        } catch (err) {
            console.error('[PROFILE] fetch saved posts error:', err);
            setSavedPosts([]);
        } finally {
            setSavedPostsLoading(false);
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

    useEffect(() => {
        loadReposts(profile?.id, profile?.name);
    }, [loadReposts, profile?.id, profile?.name]);

    useEffect(() => {
        loadSavedPosts();
    }, [loadSavedPosts]);

    useEffect(() => {
        if (activeTab === 3) {
            loadSavedPosts();
        }
    }, [activeTab, loadSavedPosts]);

    const onRefresh = useCallback(async () => {
        if (!token) return;
        setRefreshing(true);
        await Promise.all([
            loadProfile(),
            loadPosts(profile?.id, profile?.name),
            loadReposts(profile?.id, profile?.name),
            loadSavedPosts(),
        ]);
        setRefreshing(false);
    }, [loadProfile, loadPosts, loadReposts, loadSavedPosts, token, profile?.id, profile?.name]);

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

    const pickAndUploadAvatar = useCallback(async () => {
        if (!token || !isOwnProfile || avatarUploading) return;

        try {
            setAvatarUploading(true);

            const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm !== 'granted') {
                Alert.alert('Permission required', 'Please allow access to your photo library.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9,
            });

            if (result.canceled || !result.assets?.[0]) return;

            const asset = result.assets[0];
            const avatarFile = {
                uri: asset.uri,
                name: 'avatar.jpg',
                type: asset.mimeType ?? 'image/jpeg',
            };

            const form = new FormData();
            form.append('image', avatarFile);

            const res = await API.postWithAuth('mobile/profile/update', form, token);
            const updated = res?.data?.data ?? res?.data ?? null;

            if (updated) {
                setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
                if (currentUser) {
                    await saveAuth(token, { ...currentUser, ...updated });
                }
            }
        } catch (err) {
            console.error('[PROFILE] avatar upload error:', err);
            Alert.alert('Error', 'Could not update profile picture. Please try again.');
        } finally {
            setAvatarUploading(false);
        }
    }, [token, isOwnProfile, avatarUploading, currentUser, saveAuth]);

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

    if (loading) {
        return (
            <AppLayout showNavbar={false} skipTopInset>
                <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} translucent backgroundColor="transparent" />
                <ProfileSkeleton isDark={isDark} topInset={insets.top} />
            </AppLayout>
        );
    }

    if (!profile) {
        return (
            <AppLayout showNavbar={false} skipTopInset>
                <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
                    <Ionicons name="person-circle-outline" size={64} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                    <Text className="text-black/50 dark:text-dark_gray0 mt-4 text-base">Profile not found</Text>
                </View>
            </AppLayout>
        );
    }

    const profileImageUrl = resolveAvatarUrl(profile?.avatar || profile?.image);
    const coverImageUrl = profile?.cover ? resolveCoverUrl(profile.cover) : null;
    const lastExperience = getLastExperience(profile);
    const lastExperienceLocation =
        lastExperience?.location ??
        lastExperience?.city ??
        lastExperience?.place ??
        lastExperience?.address ??
        lastExperience?.region ??
        lastExperience?.country ??
        lastExperience?.company_location ??
        lastExperience?.companyLocation ??
        profile?.last_experience_location ??
        profile?.lastExperienceLocation ??
        profile?.experience_location ??
        profile?.experienceLocation ??
        profile?.city ??
        profile?.location ??
        profile?.address ??
        null;
    const speciality = profile?.speciality ?? profile?.specialty ?? null;
    const originalPosts = posts.filter((p) => !isRepostPost(p));
    const originalPostsCount = originalPosts.length;
    const repostedPosts = reposts;

    const openCreateMenu = () => setShowCreateMenu(true);
    const closeCreateMenu = () => setShowCreateMenu(false);
    const openProfileOptions = () => setShowProfileOptions(true);
    const closeProfileOptions = () => setShowProfileOptions(false);

    const handleProfileMessage = () => {
        const targetId = profile?.id ?? resolvedUserId;
        if (targetId) {
            router.push(`/(tabs)/chat/${targetId}`);
        }
    };

    const handleCreateAction = (action) => {
        closeCreateMenu();
        if (action === 'post') setShowCreatePost(true);
        if (action === 'education') setShowCreateEducation(true);
        if (action === 'experience') setShowCreateExperience(true);
    };

    return (
        <AppLayout showNavbar={false} skipTopInset>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ProfileTopBar
                profile={profile}
                isOwnProfile={isOwnProfile}
                userId={userId}
                insets={insets}
                isDark={isDark}
                onOpenOptions={openProfileOptions}
            />

            <ProfileScrollBody
                profile={profile}
                isOwnProfile={isOwnProfile}
                isDark={isDark}
                insets={insets}
                refreshing={refreshing}
                onRefresh={onRefresh}
                coverImageUrl={coverImageUrl}
                profileImageUrl={profileImageUrl}
                pickAndUploadCover={pickAndUploadCover}
                coverUploading={coverUploading}
                avatarUploading={avatarUploading}
                setShowAvatarOptions={setShowAvatarOptions}
                setShowAvatarViewer={setShowAvatarViewer}
                originalPostsCount={originalPostsCount}
                followersCount={followersCount}
                setFollowModal={setFollowModal}
                socialLinks={socialLinks}
                lastExperienceLocation={lastExperienceLocation}
                speciality={speciality}
                handleFollowToggle={handleFollowToggle}
                followLoading={followLoading}
                isFollowing={isFollowing}
                openCreateMenu={openCreateMenu}
                setShowEditProfile={setShowEditProfile}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                originalPosts={originalPosts}
                postsLoading={postsLoading}
                setSelectedPostIndex={setSelectedPostIndex}
                token={token}
                setProfile={setProfile}
                repostedPosts={repostedPosts}
                repostsLoading={repostsLoading}
                setSelectedRepostIndex={setSelectedRepostIndex}
                savedPosts={savedPosts}
                savedPostsLoading={savedPostsLoading}
                setSelectedSavedPostIndex={setSelectedSavedPostIndex}
                onMessagePress={handleProfileMessage}
                onOpenOptions={openProfileOptions}
            />

            <ProfileOptionsMenu
                visible={showProfileOptions}
                onClose={closeProfileOptions}
                profile={profile}
                insets={insets}
                isDark={isDark}
            />

            <ProfileCreateMenu
                visible={showCreateMenu}
                onClose={closeCreateMenu}
                onAction={handleCreateAction}
                insets={insets}
                isDark={isDark}
            />

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

            <EducationFormModal
                visible={showCreateEducation}
                education={null}
                token={token}
                isDark={isDark}
                onClose={() => setShowCreateEducation(false)}
                onSaved={(saved) => {
                    setProfile((prev) => {
                        if (!prev) return prev;
                        const current = Array.isArray(prev.education) ? prev.education : (Array.isArray(prev.educations) ? prev.educations : []);
                        return { ...prev, education: [saved, ...current] };
                    });
                }}
                onDeleted={() => { }}
            />

            <ExperienceFormModal
                visible={showCreateExperience}
                experience={null}
                token={token}
                isDark={isDark}
                onClose={() => setShowCreateExperience(false)}
                onSaved={(saved) => {
                    setProfile((prev) => {
                        if (!prev) return prev;
                        const current = Array.isArray(prev.experiences) ? prev.experiences : [];
                        return { ...prev, experiences: [saved, ...current] };
                    });
                }}
                onDeleted={() => { }}
            />

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

            <AvatarOptionsModal
                visible={showAvatarOptions}
                onClose={() => setShowAvatarOptions(false)}
                onView={() => {
                    setShowAvatarOptions(false);
                    setShowAvatarViewer(true);
                }}
                onChange={async () => {
                    setShowAvatarOptions(false);
                    await pickAndUploadAvatar();
                }}
                avatarUploading={avatarUploading}
                insets={insets}
                isDark={isDark}
            />

            <AvatarViewerModal
                visible={showAvatarViewer}
                onClose={() => setShowAvatarViewer(false)}
                profileImageUrl={profileImageUrl}
                insets={insets}
            />

            <PostFeedModal
                visible={selectedPostIndex >= 0}
                onClose={() => setSelectedPostIndex(-1)}
                title={profile?.name || 'Posts'}
                posts={originalPosts}
                selectedIndex={selectedPostIndex}
                feedListRef={feedListRef}
                insets={insets}
                isDark={isDark}
            />

            <RepostsFeedModal
                visible={selectedRepostIndex >= 0}
                onClose={() => setSelectedRepostIndex(-1)}
                title={profile?.name || 'Reposts'}
                posts={repostedPosts}
                selectedIndex={selectedRepostIndex}
                listRef={repostFeedListRef}
                insets={insets}
                isDark={isDark}
            />

            <SavedPostsFeedModal
                visible={selectedSavedPostIndex >= 0}
                onClose={() => setSelectedSavedPostIndex(-1)}
                posts={savedPosts}
                selectedIndex={selectedSavedPostIndex}
                insets={insets}
                isDark={isDark}
            />
        </AppLayout>
    );
}
