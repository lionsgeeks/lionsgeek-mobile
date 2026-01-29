import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import { router } from 'expo-router';
import API from '@/api';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsScreen() {
  const { user, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchNotifications();
    }
  }, [token]);

  // Map notification types to icons and colors
  const getNotificationIcon = (type) => {
    const iconMap = {
      'discipline_change': 'warning',
      'exercise_review': 'document-text',
      'project_submission': 'folder',
      'access_request': 'lock-closed',
      'access_request_response': 'checkmark-circle',
      'reservation': 'calendar',
      'appointment': 'calendar',
      'post_interaction': 'heart',
      'follow': 'person-add',
      'project_status': 'trophy',
      'task_assignment': 'briefcase',
      'project_message': 'chatbubbles',
    };
    return iconMap[type] || 'notifications';
  };

  const getNotificationColor = (type) => {
    const colorMap = {
      'discipline_change': '#f59e0b',
      'exercise_review': '#3b82f6',
      'project_submission': '#8b5cf6',
      'access_request': '#ef4444',
      'access_request_response': '#10b981',
      'reservation': '#10b981',
      'appointment': '#10b981',
      'post_interaction': '#ef4444',
      'follow': '#3b82f6',
      'project_status': '#ffc801',
      'task_assignment': '#f59e0b',
      'project_message': '#3b82f6',
    };
    return colorMap[type] || '#6b7280';
  };

  const formatNotificationForMobile = (notif) => {
    console.log('[NOTIFICATIONS] Formatting notification:', JSON.stringify(notif, null, 2));
    
    const icon = getNotificationIcon(notif.type);
    const color = getNotificationColor(notif.type);
    
    // Build title and text based on notification type
    let title = null;
    // Handle both 'message' and 'message_notification' fields
    let text = notif.message || notif.message_notification || '';
    
    switch (notif.type) {
      case 'discipline_change':
        title = 'Discipline Change';
        break;
      case 'exercise_review':
        title = 'Exercise Review Request';
        break;
      case 'project_submission':
        title = 'New Project Submission';
        break;
      case 'access_request':
        title = 'Access Request';
        break;
      case 'access_request_response':
        title = notif.status === 'approved' ? 'Access Approved' : 'Access Denied';
        break;
      case 'reservation':
        title = 'Reservation';
        break;
      case 'appointment':
        title = 'Appointment Request';
        break;
      case 'post_interaction':
        title = 'Post Interaction';
        break;
      case 'follow':
        title = 'New Follower';
        break;
      case 'project_status':
        title = notif.status === 'approved' ? 'Project Approved' : 'Project Rejected';
        break;
      case 'task_assignment':
        title = 'Task Assigned';
        break;
      case 'project_message':
        title = 'Project Message';
        break;
    }

    // Format avatar URL - match profile.jsx approach
    let avatar = null;
    const senderImage = notif.sender_image || notif.senderImage || notif.user?.avatar || notif.user?.image;
    
    if (senderImage) {
      // If it's already a full URL, return it
      if (typeof senderImage === 'string' && (senderImage.startsWith('http://') || senderImage.startsWith('https://'))) {
        avatar = senderImage;
      } else if (typeof senderImage === 'string') {
        // Check if it already includes storage path
        if (senderImage.includes('storage/')) {
          const cleanPath = senderImage.startsWith('/') ? senderImage : `/${senderImage}`;
          avatar = `${API.APP_URL}${cleanPath}`;
        } else {
          // If it's just a filename, use storage/img/profile/ like profile.jsx does
          avatar = `${API.APP_URL}/storage/img/profile/${senderImage}`;
        }
      }
    }

    return {
      id: notif.id,
      type: notif.type,
      title,
      text,
      user: {
        name: notif.sender_name || notif.senderName || 'System',
        avatar,
      },
      senderImage: avatar, // Also store as senderImage for compatibility
      time: notif.created_at ? formatDistanceToNow(new Date(notif.created_at), { addSuffix: true }) : 'Recently',
      read: !!notif.read_at,
      icon,
      color,
      link: notif.link,
      // Store original notification data for mark as read
      notificationType: notif.type,
      notificationId: notif.id,
    };
  };

  const fetchNotifications = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      // Fetch all notifications from API
      const response = await API.getWithAuth('notifications', token);
      
      console.log('[NOTIFICATIONS] Full API response:', JSON.stringify(response?.data, null, 2));
      
      if (response?.data?.notifications) {
        console.log('[NOTIFICATIONS] Raw notifications count:', response.data.notifications.length);
        console.log('[NOTIFICATIONS] Raw notifications:', JSON.stringify(response.data.notifications, null, 2));
        
        const formattedNotifications = response.data.notifications.map(formatNotificationForMobile);
        console.log('[NOTIFICATIONS] Formatted notifications count:', formattedNotifications.length);
        console.log('[NOTIFICATIONS] Formatted notifications:', JSON.stringify(formattedNotifications, null, 2));
        
        setNotifications(formattedNotifications);
      } else {
        console.warn('[NOTIFICATIONS] No notifications in response. Response data:', response?.data);
        setNotifications([]);
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Error fetching notifications:', error);
      console.error('[NOTIFICATIONS] Error details:', error?.response?.data || error?.message);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Enhanced notifications with more types (fallback - not used anymore, kept for reference)
  const fallbackNotifications = [
    {
      id: 1,
      type: 'achievement',
      title: 'New Achievement Unlocked!',
      text: 'You earned the "Code Master" badge for 100 hours of coding',
      user: { name: 'System', avatar: null },
      time: '2h ago',
      read: false,
      icon: 'trophy',
      color: '#ffc801',
    },
    {
      id: 2,
      type: 'like',
      user: { name: 'Hamza Ezzagmoute', avatar: 'https://via.placeholder.com/40' },
      text: 'liked your post about the new project',
      time: '3h ago',
      read: false,
      icon: 'heart',
      color: '#ef4444',
    },
    {
      id: 3,
      type: 'comment',
      user: { name: 'Nabil SAKR', avatar: 'https://via.placeholder.com/40' },
      text: 'commented on your post: "Great work!"',
      time: '5h ago',
      read: false,
      icon: 'chatbubble',
      color: '#3b82f6',
    },
    {
      id: 4,
      type: 'project',
      title: 'New Project Invitation',
      text: 'Mehdi Forkani added you to project "Mobile App Redesign"',
      user: { name: 'Mehdi Forkani', avatar: 'https://via.placeholder.com/40' },
      time: '1d ago',
      read: true,
      icon: 'folder',
      color: '#f59e0b',
    },
    {
      id: 5,
      type: 'reminder',
      title: 'Upcoming Reservation',
      text: 'Your coworking space reservation starts in 2 hours',
      user: { name: 'System', avatar: null },
      time: '1d ago',
      read: true,
      icon: 'calendar',
      color: '#10b981',
    },
    {
      id: 6,
      type: 'rank',
      title: 'Ranking Updated',
      text: 'You moved up 3 places in the leaderboard!',
      user: { name: 'System', avatar: null },
      time: '2d ago',
      read: true,
      icon: 'trending-up',
      color: '#8b5cf6',
    },
  ];

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const markNotificationAsRead = async (notification) => {
    if (!token || notification.read) return;
    
    try {
      // Extract type and id from notification ID (format: 'type-id' or 'type-numeric-id')
      const notificationId = notification.id || '';
      const parts = notificationId.split('-');
      
      if (parts.length < 2) {
        console.warn('[NOTIFICATIONS] Invalid notification ID format:', notificationId);
        return;
      }
      
      // Map notification ID prefix to API type format
      const typeMap = {
        'discipline': 'discipline_change',
        'exercise-review': 'exercise-review',
        'project-submission': 'project-submission',
        'access-request': 'access_request',
        'access-request-response': 'access_request_response',
        'reservation': 'reservation',
        'appointment': 'appointment',
        'post': 'post',
        'follow': 'follow',
        'project-status': 'project-status',
        'task-assignment': 'task-assignment',
        'project-message': 'project-message',
      };
      
      const prefix = parts.slice(0, -1).join('-'); // Get all parts except the last one
      const type = typeMap[prefix] || prefix;
      const id = parts[parts.length - 1]; // Last part is the numeric ID
      
      if (type && id) {
        await API.postWithAuth(`api/notifications/${type}/${id}/read`, {}, token);
        
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
      }
    } catch (error) {
      console.error('[NOTIFICATIONS] Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    
    try {
      await API.postWithAuth('notifications/mark-all-read', {}, token);
      
      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('[NOTIFICATIONS] Error marking all as read:', error);
    }
  };

  // Helper function to get avatar URL - match profile.jsx approach
  const getAvatar = (notification) => {
    try {
      const avatar = notification.user?.avatar || notification.senderImage;
      
      if (!avatar) return null;
      
      // If it's already a full URL, return it
      if (typeof avatar === 'string' && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
        return avatar;
      }
      
      if (typeof avatar === 'string') {
        // Check if it already includes storage path
        if (avatar.includes('storage/')) {
          const cleanPath = avatar.startsWith('/') ? avatar : `/${avatar}`;
          return `${API.APP_URL}${cleanPath}`;
        } else {
          // If it's just a filename, use storage/img/profile/ like profile.jsx does
          return `${API.APP_URL}/storage/img/profile/${avatar}`;
        }
      }
    } catch (error) {
      console.log('[NOTIFICATIONS] Error getting avatar URL:', error);
    }
    return null;
  };

  const handleNotificationPress = async (notification) => {
    // Mark as read when pressed
    if (!notification.read) {
      await markNotificationAsRead(notification);
    }
    
    // Navigate based on notification type and link
    if (notification.link) {
      // Handle different link formats
      if (notification.link.startsWith('/admin/')) {
        // Admin links - might not be accessible in mobile, just show notification
        console.log('Admin link:', notification.link);
      } else if (notification.link.startsWith('/students/')) {
        // Student profile or project links
        const parts = notification.link.split('/');
        if (parts.includes('project')) {
          router.push('/(tabs)/projects');
        }
      } else if (notification.link.startsWith('/feed')) {
        // Feed link
        router.push('/(tabs)/index');
      } else if (notification.link.includes('reservations')) {
        router.push('/(tabs)/reservations');
      } else if (notification.type === 'reservation' || notification.type === 'appointment') {
        router.push('/(tabs)/reservations');
      } else if (notification.type === 'project_submission' || notification.type === 'project_status') {
        router.push('/(tabs)/projects');
      }
    } else {
      // Fallback navigation based on type
      if (notification.type === 'reservation' || notification.type === 'appointment') {
        router.push('/(tabs)/reservations');
      } else if (notification.type === 'project_submission' || notification.type === 'project_status') {
        router.push('/(tabs)/projects');
      } else if (notification.type === 'post_interaction' || notification.type === 'follow') {
        router.push('/(tabs)/index');
      }
    }
  };

  const testPushNotification = async () => {
    if (!token) {
      alert('No authentication token found');
      return;
    }

    try {
      console.log('🧪 Testing push notification...');
      const response = await API.postWithAuth('mobile/test-push', {
        title: '🧪 Test Push Notification',
        body: 'This is a test push notification! If you see this on your phone, push notifications are working! 🎉',
      }, token);

      console.log('✅ Test push response:', JSON.stringify(response?.data, null, 2));
      
      if (response?.data?.success) {
        alert('✅ Test notification sent! Check your phone (make sure app is in background/closed).');
      } else {
        alert('❌ Failed to send test notification. Check console logs for details.');
      }
    } catch (error) {
      console.error('❌ Test push error:', error);
      console.error('Error details:', error?.response?.data || error?.message);
      alert('❌ Error: ' + (error?.response?.data?.message || error?.message || 'Unknown error'));
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        {/* Header */}
        <View className="bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 pt-12 pb-4 px-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center">
              <TouchableOpacity onPress={() => router.back()} className="mr-3">
                <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
              <View>
                <Text className="text-2xl font-bold text-black dark:text-white">Notifications</Text>
                {unreadCount > 0 && (
                  <Text className="text-sm text-black/60 dark:text-white/60 mt-1">{unreadCount} unread</Text>
                )}
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              {/* Test Push Button */}
              <TouchableOpacity 
                onPress={testPushNotification}
                className="bg-green-500/20 dark:bg-green-500/30 rounded-full px-3 py-2 mr-2"
              >
                <Ionicons name="notifications" size={16} color="#10b981" />
              </TouchableOpacity>
              {unreadCount > 0 && (
                <TouchableOpacity 
                  onPress={markAllAsRead}
                  className="bg-alpha/20 dark:bg-alpha/30 rounded-full px-4 py-2"
                >
                  <Text className="text-alpha text-sm font-bold">Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Notifications List */}
        <ScrollView 
          className="flex-1" 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffc801" />
          }
        >
          <View className="px-6 pt-4 pb-8">
            {loading ? (
              <View className="py-16 items-center">
                <ActivityIndicator size="large" color="#ffc801" />
                <Text className="text-black/60 dark:text-white/60 mt-4">Loading notifications...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View className="py-16 items-center">
                <Ionicons name="notifications-outline" size={64} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                <Text className="text-center text-black/60 dark:text-white/60 mt-4 text-base">
                  No notifications yet
                </Text>
                <Text className="text-center text-black/40 dark:text-white/40 mt-2 text-sm">
                  You're all caught up!
                </Text>
              </View>
            ) : (
              <>
                {/* Today Section (Unread) */}
                {notifications.filter(n => !n.read).length > 0 && (
                  <View className="mb-4">
                    <Text className="text-sm font-bold text-black/50 dark:text-white/50 uppercase mb-3">Today</Text>
                    {notifications.filter(n => !n.read).map((notification) => (
                    <TouchableOpacity
                      key={notification.id}
                      onPress={() => handleNotificationPress(notification)}
                      className={`mb-3 p-4 rounded-2xl border active:opacity-80 bg-alpha/10 dark:bg-alpha/20 border-alpha/30`}
                    >
                      <View className="flex-row items-start">
                        <View className="relative mr-4">
                          {getAvatar(notification) ? (
                            <Image
                              source={{ uri: getAvatar(notification) }}
                              className="w-14 h-14 rounded-full border-2 border-alpha/50"
                              placeholder={require('@/assets/images/icon.png')}
                              contentFit="cover"
                              transition={200}
                              style={{ width: 56, height: 56, borderRadius: 28 }}
                              onError={(error) => {
                                console.log('[NOTIFICATIONS] Error loading avatar:', getAvatar(notification), error);
                              }}
                            />
                          ) : (
                            <View className="w-14 h-14 rounded-full bg-beta/20 dark:bg-beta/40 items-center justify-center border-2 border-beta/30">
                              <Ionicons
                                name={notification.icon || 'notifications'}
                                size={24}
                                color={notification.color || '#6b7280'}
                              />
                            </View>
                          )}
                        </View>
                        <View className="flex-1">
                          {notification.title && (
                            <Text className="text-base font-bold text-black dark:text-white mb-1">
                              {notification.title}
                            </Text>
                          )}
                          <Text className="text-sm text-black/80 dark:text-white/80 leading-5">
                            {notification.user?.name && notification.type !== 'discipline_change' && notification.type !== 'access_request_response' && notification.type !== 'project_status' && (
                              <Text className="font-semibold">{notification.user.name} </Text>
                            )}
                            {notification.text}
                          </Text>
                          <View className="flex-row items-center mt-2">
                            <Ionicons 
                              name="time-outline" 
                              size={12} 
                              color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} 
                            />
                            <Text className="text-xs text-black/50 dark:text-white/50 ml-1">
                              {notification.time}
                            </Text>
                          </View>
                        </View>
                        <View className="ml-2">
                          <View className="w-2 h-2 rounded-full bg-alpha" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  </View>
                )}

                {/* Earlier Section (Read) */}
                {notifications.filter(n => n.read).length > 0 && (
                  <View className="mt-4">
                    <Text className="text-sm font-bold text-black/50 dark:text-white/50 uppercase mb-3">Earlier</Text>
                    {notifications.filter(n => n.read).map((notification) => (
                      <TouchableOpacity
                        key={notification.id}
                        onPress={() => handleNotificationPress(notification)}
                        className="mb-3 p-4 rounded-2xl border bg-light dark:bg-dark border-light/20 dark:border-dark/20 active:opacity-70"
                      >
                      <View className="flex-row items-start">
                        <View className="relative mr-4">
                          {getAvatar(notification) ? (
                            <Image
                              source={{ uri: getAvatar(notification) }}
                              className="w-14 h-14 rounded-full opacity-70"
                              defaultSource={require('@/assets/images/icon.png')}
                            />
                          ) : (
                            <View className="w-14 h-14 rounded-full bg-beta/10 dark:bg-beta/20 items-center justify-center opacity-50">
                              <Ionicons
                                name={notification.icon || 'notifications'}
                                size={24}
                                color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                              />
                            </View>
                          )}
                        </View>
                        <View className="flex-1">
                          {notification.title && (
                            <Text className="text-base font-bold text-black/80 dark:text-white/80 mb-1">
                              {notification.title}
                            </Text>
                          )}
                          <Text className="text-sm text-black/60 dark:text-white/60 leading-5">
                            {notification.user?.name && notification.type !== 'discipline_change' && notification.type !== 'access_request_response' && notification.type !== 'project_status' && (
                              <Text className="font-semibold">{notification.user.name} </Text>
                            )}
                            {notification.text}
                          </Text>
                          <View className="flex-row items-center mt-2">
                            <Ionicons 
                              name="time-outline" 
                              size={12} 
                              color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} 
                            />
                            <Text className="text-xs text-black/40 dark:text-white/40 ml-1">
                              {notification.time}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                  </View>
                )}
                
                {/* Show message if all notifications are read */}
                {notifications.length > 0 && notifications.filter(n => !n.read).length === 0 && notifications.filter(n => n.read).length === 0 && (
                  <View className="py-8 items-center">
                    <Text className="text-center text-black/60 dark:text-white/60 text-sm">
                      All notifications have been processed
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </AppLayout>
  );
}
