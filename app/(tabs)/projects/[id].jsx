import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import Skeleton from '@/components/ui/Skeleton';
import API from '@/api';
import { Colors } from '@/constants/Colors';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid-outline' },
  { id: 'tasks', label: 'Tasks', icon: 'checkbox-outline' },
  { id: 'team', label: 'Team', icon: 'people-outline' },
  { id: 'notes', label: 'Notes', icon: 'document-text-outline' },
  { id: 'files', label: 'Files', icon: 'folder-outline' },
];

const STATUS_FLOW = ['todo', 'in_progress', 'review', 'completed'];

const TASK_STATUS = {
  todo: { label: 'To do', color: '#6b7280' },
  in_progress: { label: 'In progress', color: '#2563eb' },
  review: { label: 'Review', color: '#7c3aed' },
  completed: { label: 'Done', color: '#16a34a' },
};

const PRIORITY = {
  low: { label: 'Low', color: '#16a34a' },
  medium: { label: 'Medium', color: '#d97706' },
  high: { label: 'High', color: '#ea580c' },
  urgent: { label: 'Urgent', color: '#dc2626' },
};

function formatBytes(n) {
  const num = Number(n) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

function Avatar({ uri, name, size = 40, isDark }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: isDark ? '#2a2a2a' : '#ececec',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '800', fontSize: size * 0.34 }}>
          {(name || 'U').charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function TaskCard({ task, isDark, pending, canManage, onCycleStatus, onEdit, onDelete }) {
  const text = isDark ? '#fff' : '#111';
  const muted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.48)';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const status = TASK_STATUS[task.status] || TASK_STATUS.todo;
  const priority = PRIORITY[task.priority] || PRIORITY.medium;
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const doneSubs = subtasks.filter((s) => s.completed).length;
  const showActions = canManage || task.can_update_status;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: border,
        borderRadius: 16,
        padding: 14,
        backgroundColor: isDark ? Colors.card_dark : '#fff',
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            {task.is_pinned ? <Ionicons name="pin" size={13} color={Colors.alpha} /> : null}
            <Text style={{ color: priority.color, fontSize: 11, fontWeight: '800' }}>{priority.label}</Text>
          </View>
          <Text style={{ color: text, fontSize: 15, fontWeight: '800' }}>{task.title}</Text>
          {task.description ? (
            <Text style={{ color: muted, fontSize: 13, marginTop: 4, lineHeight: 18 }} numberOfLines={3}>
              {task.description}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {task.assigned_to ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Avatar uri={task.assigned_to.avatar} name={task.assigned_to.name} size={22} isDark={isDark} />
                <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>{task.assigned_to.name}</Text>
              </View>
            ) : null}
            {task.due_date ? (
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>Due {task.due_date}</Text>
            ) : null}
            {subtasks.length > 0 ? (
              <Text style={{ color: muted, fontSize: 12, fontWeight: '600' }}>
                Subtasks {doneSubs}/{subtasks.length}
              </Text>
            ) : null}
          </View>
        </View>
        {showActions ? (
          <View style={{ gap: 4 }}>
            <Pressable onPress={() => onEdit(task)} hitSlop={6} style={{ padding: 4 }}>
              <Ionicons name="create-outline" size={18} color={muted} />
            </Pressable>
            {canManage ? (
              <Pressable onPress={() => onDelete(task)} hitSlop={6} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <Pressable
        disabled={!task.can_update_status || pending}
        onPress={() => onCycleStatus(task)}
        style={({ pressed }) => ({
          marginTop: 12,
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: `${status.color}18`,
          opacity: pressed || pending ? 0.65 : task.can_update_status ? 1 : 0.55,
        })}
      >
        {pending ? (
          <ActivityIndicator size="small" color={status.color} />
        ) : (
          <Ionicons name="swap-horizontal" size={14} color={status.color} />
        )}
        <Text style={{ color: status.color, fontSize: 12, fontWeight: '800' }}>{status.label}</Text>
        {task.can_update_status ? (
          <Text style={{ color: muted, fontSize: 11, fontWeight: '600' }}>Tap to advance</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams();
  const projectId = Array.isArray(id) ? id[0] : id;
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [tab, setTab] = useState('overview');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [searchingMembers, setSearchingMembers] = useState(false);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);

  const text = isDark ? '#fff' : '#111';
  const muted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.48)';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const fieldBg = isDark ? 'rgba(255,255,255,0.05)' : '#fff';

  const project = payload?.project;
  const tasks = payload?.tasks || [];
  const team = payload?.team || [];
  const notes = payload?.notes || [];
  const attachments = payload?.attachments || [];
  const isOwner = !!project?.is_owner;
  const canManageTasks = !!project?.can_manage_tasks;
  const canManageTeam = !!project?.can_manage_team;

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setError(null);
    try {
      const data = await API.getProject(projectId, token);
      setPayload(data);
    } catch (e) {
      console.error('[PROJECT DETAIL]', e);
      setError('Could not load this project.');
      setPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, projectId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!token || !inviteOpen || memberQuery.trim().length < 2) {
      setMemberResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingMembers(true);
      try {
        const data = await API.searchUsers(memberQuery.trim(), token);
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        const teamIds = new Set(team.map((m) => Number(m.id)));
        setMemberResults(
          results.filter((u) => u?.id && Number(u.id) !== Number(user?.id) && !teamIds.has(Number(u.id)))
        );
      } catch (_) {
        setMemberResults([]);
      } finally {
        setSearchingMembers(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [memberQuery, token, inviteOpen, team, user?.id]);

  const openEditProject = useCallback(() => {
    if (!project) return;
    router.push({
      pathname: '/(tabs)/projects/form',
      params: {
        id: String(project.id),
        name: project.name || '',
        description: project.description || '',
        status: project.status || 'active',
      },
    });
  }, [project]);

  const confirmDeleteProject = useCallback(() => {
    Alert.alert('Delete project', 'This permanently deletes the project and its tasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await API.deleteProject(projectId, token);
            router.replace('/(tabs)/projects');
          } catch (e) {
            Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not delete.');
          }
        },
      },
    ]);
  }, [projectId, token]);

  const showOwnerMenu = useCallback(() => {
    Alert.alert(project?.name || 'Project', undefined, [
      { text: 'Edit project', onPress: openEditProject },
      { text: 'Delete project', style: 'destructive', onPress: confirmDeleteProject },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [project?.name, openEditProject, confirmDeleteProject]);

  const cycleStatus = useCallback(
    async (task) => {
      if (!token || !projectId || !task?.can_update_status) return;
      const idx = STATUS_FLOW.indexOf(task.status);
      const next = STATUS_FLOW[(idx + 1) % STATUS_FLOW.length];

      if (next === 'completed' && !project?.can_manage_tasks) {
        Alert.alert('Not allowed', 'Only project admins or the owner can mark tasks as completed.');
        return;
      }

      setPendingTaskId(task.id);
      try {
        const data = await API.updateProjectTaskStatus(projectId, task.id, next, token);
        if (data?.task) {
          setPayload((prev) => {
            if (!prev) return prev;
            const nextTasks = prev.tasks.map((t) => (t.id === task.id ? data.task : t));
            const completed = nextTasks.filter((t) => t.status === 'completed').length;
            const total = nextTasks.length;
            return {
              ...prev,
              tasks: nextTasks,
              project: {
                ...prev.project,
                tasks_count: total,
                completed_tasks_count: completed,
                active_tasks_count: total - completed,
                progress_percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
              },
            };
          });
        } else {
          await load();
        }
      } catch (e) {
        Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not update task.');
      } finally {
        setPendingTaskId(null);
      }
    },
    [token, projectId, project?.can_manage_tasks, load]
  );

  const openTaskForm = useCallback(
    (task) => {
      if (task) {
        router.push({
          pathname: '/(tabs)/projects/task-form',
          params: {
            projectId: String(projectId),
            taskId: String(task.id),
            title: task.title || '',
            description: task.description || '',
            priority: task.priority || 'medium',
            status: task.status || 'todo',
            assignedTo: task.assigned_to?.id ? String(task.assigned_to.id) : '',
            dueDate: task.due_date || '',
          },
        });
      } else {
        router.push({
          pathname: '/(tabs)/projects/task-form',
          params: { projectId: String(projectId) },
        });
      }
    },
    [projectId]
  );

  const deleteTask = useCallback(
    (task) => {
      Alert.alert('Delete task', `Remove “${task.title}”?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.deleteProjectTask(projectId, task.id, token);
              await load();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not delete task.');
            }
          },
        },
      ]);
    },
    [projectId, token, load]
  );

  const addMemberById = useCallback(
    async (userId, role = 'member') => {
      try {
        setInviteBusy(true);
        await API.addProjectMember(projectId, { userId, role }, token);
        setMemberQuery('');
        setMemberResults([]);
        await load();
        Alert.alert('Added', 'Member added to the project.');
      } catch (e) {
        Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not add member.');
      } finally {
        setInviteBusy(false);
      }
    },
    [projectId, token, load]
  );

  const sendInvite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email) {
      Alert.alert('Missing email', 'Enter an email to invite.');
      return;
    }
    try {
      setInviteBusy(true);
      await API.inviteProjectMember(projectId, { email, role: inviteRole }, token);
      setInviteEmail('');
      await load();
      Alert.alert('Invited', 'Invitation sent.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not invite.');
    } finally {
      setInviteBusy(false);
    }
  }, [inviteEmail, inviteRole, projectId, token, load]);

  const changeMemberRole = useCallback(
    (member) => {
      if (!canManageTeam || member.is_owner) return;
      const next = member.role === 'admin' ? 'member' : 'admin';
      Alert.alert('Change role', `Set ${member.name} as ${next}?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await API.updateProjectMemberRole(projectId, member.id, next, token);
              await load();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not update role.');
            }
          },
        },
      ]);
    },
    [canManageTeam, projectId, token, load]
  );

  const removeMember = useCallback(
    (member) => {
      if (!canManageTeam || member.is_owner) return;
      Alert.alert('Remove member', `Remove ${member.name} from this project?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.removeProjectMember(projectId, member.id, token);
              await load();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not remove.');
            }
          },
        },
      ]);
    },
    [canManageTeam, projectId, token, load]
  );

  const saveNote = useCallback(async () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      Alert.alert('Missing fields', 'Title and content are required.');
      return;
    }
    try {
      setNoteBusy(true);
      await API.createProjectNote(
        projectId,
        { title: noteTitle.trim(), content: noteContent.trim() },
        token
      );
      setNoteTitle('');
      setNoteContent('');
      setNoteOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not save note.');
    } finally {
      setNoteBusy(false);
    }
  }, [noteTitle, noteContent, projectId, token, load]);

  const deleteNote = useCallback(
    (note) => {
      Alert.alert('Delete note', `Delete “${note.title}”?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.deleteProjectNote(projectId, note.id, token);
              await load();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not delete note.');
            }
          },
        },
      ]);
    },
    [projectId, token, load]
  );

  const uploadFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || 'file',
        type: asset.mimeType || 'application/octet-stream',
      });
      setUploading(true);
      await API.uploadProjectAttachment(projectId, formData, token);
      await load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not upload file.');
    } finally {
      setUploading(false);
    }
  }, [projectId, token, load]);

  const deleteAttachment = useCallback(
    (file) => {
      Alert.alert('Delete file', `Delete “${file.name}”?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.deleteProjectAttachment(projectId, file.id, token);
              await load();
            } catch (e) {
              Alert.alert('Error', e?.response?.data?.message || e?.message || 'Could not delete file.');
            }
          },
        },
      ]);
    },
    [projectId, token, load]
  );

  const myTasks = useMemo(() => {
    const uid = Number(user?.id);
    return tasks.filter((t) => Number(t.assigned_to?.id) === uid || t.can_update_status);
  }, [tasks, user?.id]);

  if (!token) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black dark:text-white font-semibold">Sign in to open projects.</Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: hairline,
            backgroundColor: isDark ? Colors.card_dark : '#fff',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
              <Ionicons name="arrow-back" size={24} color={text} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: text, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
                {project?.name || 'Project'}
              </Text>
              {project?.my_role ? (
                <Text style={{ color: muted, fontSize: 12, marginTop: 2, fontWeight: '600' }}>
                  Your role · {project.my_role}
                </Text>
              ) : null}
            </View>
            {isOwner ? (
              <Pressable
                onPress={showOwnerMenu}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={text} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                router.push({ pathname: '/(tabs)/projects/chat', params: { id: String(projectId) } })
              }
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,200,1,0.12)' : 'rgba(255,200,1,0.2)',
              }}
            >
              <Ionicons name="chatbubbles-outline" size={20} color={isDark ? Colors.alpha : '#111'} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingTop: 12 }}
          >
            {TABS.map((t) => {
              const selected = tab === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    paddingVertical: 9,
                    paddingHorizontal: 14,
                    borderRadius: 12,
                    backgroundColor: selected ? Colors.alpha : isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
                  }}
                >
                  <Ionicons name={t.icon} size={14} color={selected ? '#111' : muted} />
                  <Text style={{ color: selected ? '#111' : text, fontSize: 12, fontWeight: '800' }}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Skeleton width="100%" height={120} borderRadius={16} isDark={isDark} />
            <Skeleton width="100%" height={80} borderRadius={16} isDark={isDark} />
            <Skeleton width="100%" height={80} borderRadius={16} isDark={isDark} />
          </View>
        ) : error || !project ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
            <Ionicons name="alert-circle-outline" size={36} color={muted} />
            <Text style={{ color: text, marginTop: 12, fontWeight: '700', textAlign: 'center' }}>
              {error || 'Project not found'}
            </Text>
            <Pressable
              onPress={load}
              style={{
                marginTop: 16,
                backgroundColor: Colors.alpha,
                paddingHorizontal: 18,
                paddingVertical: 10,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: '#111', fontWeight: '800' }}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.alpha} />
            }
          >
            {tab === 'overview' ? (
              <View style={{ gap: 12 }}>
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: hairline,
                    backgroundColor: isDark ? Colors.card_dark : '#fff',
                    padding: 14,
                    overflow: 'hidden',
                  }}
                >
                  {project.photo ? (
                    <Image
                      source={{ uri: project.photo }}
                      style={{ width: '100%', height: 140, borderRadius: 14, marginBottom: 12 }}
                    />
                  ) : null}
                  <Text style={{ color: text, fontSize: 16, fontWeight: '800' }}>{project.name}</Text>
                  {project.description ? (
                    <Text style={{ color: muted, marginTop: 8, lineHeight: 20, fontSize: 14 }}>
                      {project.description}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f7f7f7',
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>PROGRESS</Text>
                      <Text style={{ color: text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
                        {project.progress_percentage || 0}%
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f7f7f7',
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>TASKS</Text>
                      <Text style={{ color: text, fontSize: 22, fontWeight: '800', marginTop: 4 }}>
                        {project.completed_tasks_count || 0}/{project.tasks_count || 0}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f7f7f7',
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>TEAM</Text>
                      <Text style={{ color: text, fontSize: 18, fontWeight: '800', marginTop: 4 }}>
                        {project.members_count || team.length}
                      </Text>
                    </View>
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f7f7f7',
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: muted, fontSize: 11, fontWeight: '700' }}>STATUS</Text>
                      <Text
                        style={{
                          color: text,
                          fontSize: 14,
                          fontWeight: '800',
                          marginTop: 6,
                          textTransform: 'capitalize',
                        }}
                      >
                        {(project.status || 'active').replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: text, fontSize: 14, fontWeight: '800' }}>Assigned to you</Text>
                  <Pressable onPress={() => openTaskForm(null)}>
                    <Text style={{ color: Colors.alpha, fontWeight: '800', fontSize: 13 }}>Add task</Text>
                  </Pressable>
                </View>
                {myTasks.length === 0 ? (
                  <Text style={{ color: muted, fontSize: 13 }}>No tasks assigned to you right now.</Text>
                ) : (
                  myTasks.slice(0, 4).map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isDark={isDark}
                      pending={pendingTaskId === task.id}
                      canManage={canManageTasks}
                      onCycleStatus={cycleStatus}
                      onEdit={openTaskForm}
                      onDelete={deleteTask}
                    />
                  ))
                )}
              </View>
            ) : null}

            {tab === 'tasks' ? (
              <View>
                <Pressable
                  onPress={() => openTaskForm(null)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: Colors.alpha,
                    borderRadius: 14,
                    paddingVertical: 12,
                    marginBottom: 14,
                  }}
                >
                  <Ionicons name="add" size={18} color="#111" />
                  <Text style={{ color: '#111', fontWeight: '800' }}>New task</Text>
                </Pressable>
                {tasks.length === 0 ? (
                  <Text style={{ color: muted, textAlign: 'center', marginTop: 24 }}>No tasks yet.</Text>
                ) : (
                  tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isDark={isDark}
                      pending={pendingTaskId === task.id}
                      canManage={canManageTasks}
                      onCycleStatus={cycleStatus}
                      onEdit={openTaskForm}
                      onDelete={deleteTask}
                    />
                  ))
                )}
              </View>
            ) : null}

            {tab === 'team' ? (
              <View style={{ gap: 8 }}>
                {canManageTeam ? (
                  <Pressable
                    onPress={() => setInviteOpen(true)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      backgroundColor: Colors.alpha,
                      borderRadius: 14,
                      paddingVertical: 12,
                      marginBottom: 6,
                    }}
                  >
                    <Ionicons name="person-add-outline" size={18} color="#111" />
                    <Text style={{ color: '#111', fontWeight: '800' }}>Add / invite member</Text>
                  </Pressable>
                ) : null}
                {team.map((member) => (
                  <View
                    key={member.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: hairline,
                      backgroundColor: isDark ? Colors.card_dark : '#fff',
                    }}
                  >
                    <Avatar uri={member.avatar} name={member.name} size={44} isDark={isDark} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                        {member.name}
                      </Text>
                      <Text style={{ color: muted, fontSize: 12, marginTop: 2, fontWeight: '600' }}>
                        {(member.role || 'member').replace('_', ' ')}
                        {member.is_owner ? ' · owner' : ''}
                      </Text>
                    </View>
                    {canManageTeam && !member.is_owner ? (
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <Pressable onPress={() => changeMemberRole(member)} hitSlop={6} style={{ padding: 6 }}>
                          <Ionicons name="swap-horizontal" size={18} color={muted} />
                        </Pressable>
                        <Pressable onPress={() => removeMember(member)} hitSlop={6} style={{ padding: 6 }}>
                          <Ionicons name="person-remove-outline" size={18} color="#dc2626" />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {tab === 'notes' ? (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setNoteOpen(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: Colors.alpha,
                    borderRadius: 14,
                    paddingVertical: 12,
                  }}
                >
                  <Ionicons name="add" size={18} color="#111" />
                  <Text style={{ color: '#111', fontWeight: '800' }}>New note</Text>
                </Pressable>
                {notes.length === 0 ? (
                  <Text style={{ color: muted, textAlign: 'center', marginTop: 20 }}>No notes yet.</Text>
                ) : (
                  notes.map((note) => (
                    <View
                      key={note.id}
                      style={{
                        borderWidth: 1,
                        borderColor: hairline,
                        borderRadius: 16,
                        padding: 14,
                        backgroundColor: isDark ? Colors.card_dark : '#fff',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {note.is_pinned ? <Ionicons name="pin" size={13} color={Colors.alpha} /> : null}
                            <Text style={{ color: text, fontWeight: '800', fontSize: 15 }}>{note.title}</Text>
                          </View>
                          <Text style={{ color: muted, marginTop: 6, lineHeight: 19, fontSize: 13 }}>
                            {note.content}
                          </Text>
                          <Text style={{ color: muted, marginTop: 8, fontSize: 11, fontWeight: '600' }}>
                            {note.user?.name || 'Someone'}
                            {note.created_at ? ` · ${note.created_at}` : ''}
                          </Text>
                        </View>
                        <Pressable onPress={() => deleteNote(note)} hitSlop={6} style={{ padding: 4 }}>
                          <Ionicons name="trash-outline" size={18} color="#dc2626" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            ) : null}

            {tab === 'files' ? (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={uploadFile}
                  disabled={uploading}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    backgroundColor: Colors.alpha,
                    borderRadius: 14,
                    paddingVertical: 12,
                    opacity: uploading ? 0.65 : 1,
                  }}
                >
                  {uploading ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#111" />
                      <Text style={{ color: '#111', fontWeight: '800' }}>Upload file</Text>
                    </>
                  )}
                </Pressable>
                {attachments.length === 0 ? (
                  <Text style={{ color: muted, textAlign: 'center', marginTop: 20 }}>No files yet.</Text>
                ) : (
                  attachments.map((file) => (
                    <View
                      key={file.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        borderWidth: 1,
                        borderColor: hairline,
                        borderRadius: 14,
                        padding: 12,
                        backgroundColor: isDark ? Colors.card_dark : '#fff',
                      }}
                    >
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name="document-outline" size={20} color={muted} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: text, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                          {file.name}
                        </Text>
                        <Text style={{ color: muted, fontSize: 11, marginTop: 2, fontWeight: '600' }}>
                          {formatBytes(file.size)}
                          {file.uploader ? ` · ${file.uploader}` : ''}
                        </Text>
                      </View>
                      <Pressable onPress={() => deleteAttachment(file)} hitSlop={6} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={18} color="#dc2626" />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </ScrollView>
        )}

        <Modal visible={inviteOpen} animationType="slide" transparent onRequestClose={() => setInviteOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View
              style={{
                backgroundColor: isDark ? Colors.card_dark : '#fff',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 18,
                maxHeight: '85%',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ flex: 1, color: text, fontSize: 17, fontWeight: '800' }}>Add member</Text>
                <Pressable onPress={() => setInviteOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={text} />
                </Pressable>
              </View>

              <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                SEARCH USERS
              </Text>
              <TextInput
                value={memberQuery}
                onChangeText={setMemberQuery}
                placeholder="Name or email"
                placeholderTextColor={muted}
                style={{
                  borderWidth: 1,
                  borderColor: hairline,
                  backgroundColor: fieldBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 10,
                  color: text,
                  marginBottom: 8,
                }}
              />
              {searchingMembers ? <ActivityIndicator color={Colors.alpha} style={{ marginBottom: 8 }} /> : null}
              <ScrollView style={{ maxHeight: 160, marginBottom: 14 }}>
                {memberResults.map((u) => (
                  <Pressable
                    key={u.id}
                    disabled={inviteBusy}
                    onPress={() => addMemberById(u.id, inviteRole)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: hairline,
                    }}
                  >
                    <Avatar uri={u.avatar || u.image} name={u.name} size={36} isDark={isDark} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: text, fontWeight: '700' }}>{u.name}</Text>
                      {u.email ? <Text style={{ color: muted, fontSize: 12 }}>{u.email}</Text> : null}
                    </View>
                    <Ionicons name="add-circle" size={22} color={Colors.alpha} />
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={{ color: muted, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
                OR INVITE BY EMAIL
              </Text>
              <TextInput
                value={inviteEmail}
                onChangeText={setInviteEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="email@example.com"
                placeholderTextColor={muted}
                style={{
                  borderWidth: 1,
                  borderColor: hairline,
                  backgroundColor: fieldBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 10,
                  color: text,
                  marginBottom: 10,
                }}
              />

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {['member', 'admin'].map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setInviteRole(r)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: inviteRole === r ? Colors.alpha : isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5',
                    }}
                  >
                    <Text style={{ color: inviteRole === r ? '#111' : text, fontWeight: '800', fontSize: 12 }}>
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={sendInvite}
                disabled={inviteBusy}
                style={{
                  backgroundColor: Colors.alpha,
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: inviteBusy ? 0.65 : 1,
                }}
              >
                {inviteBusy ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={{ color: '#111', fontWeight: '800' }}>Send invite</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={noteOpen} animationType="slide" transparent onRequestClose={() => setNoteOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View
              style={{
                backgroundColor: isDark ? Colors.card_dark : '#fff',
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 18,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ flex: 1, color: text, fontSize: 17, fontWeight: '800' }}>New note</Text>
                <Pressable onPress={() => setNoteOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={text} />
                </Pressable>
              </View>
              <TextInput
                value={noteTitle}
                onChangeText={setNoteTitle}
                placeholder="Title"
                placeholderTextColor={muted}
                style={{
                  borderWidth: 1,
                  borderColor: hairline,
                  backgroundColor: fieldBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: Platform.OS === 'ios' ? 12 : 10,
                  color: text,
                  marginBottom: 10,
                  fontWeight: '700',
                }}
              />
              <TextInput
                value={noteContent}
                onChangeText={setNoteContent}
                placeholder="Write your note…"
                placeholderTextColor={muted}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: hairline,
                  backgroundColor: fieldBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  color: text,
                  minHeight: 120,
                  textAlignVertical: 'top',
                  marginBottom: 14,
                }}
              />
              <Pressable
                onPress={saveNote}
                disabled={noteBusy}
                style={{
                  backgroundColor: Colors.alpha,
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: noteBusy ? 0.65 : 1,
                }}
              >
                {noteBusy ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={{ color: '#111', fontWeight: '800' }}>Save note</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </AppLayout>
  );
}
