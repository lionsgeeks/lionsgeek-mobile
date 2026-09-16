import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar as RNStatusBar,
  StyleSheet,
  Dimensions,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, router as expoRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import StoryVideo from './Partials/StoryVideo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context';
import API from '@/api';
import EditableOverlayLayer from './Partials/editor/EditableOverlayLayer';
import TextInputModal from './Partials/editor/TextInputModal';
import EmojiPickerSheet from './Partials/editor/EmojiPickerSheet';
import DrawingCanvas from './Partials/editor/DrawingCanvas';
import UserPickerSheet from './Partials/editor/UserPickerSheet';
import MusicPickerSheet from './Partials/editor/MusicPickerSheet';
import InteractiveStickerSheet from './Partials/editor/InteractiveStickerSheet';
import CameraCapture from './Partials/editor/CameraCapture';
import CollagePicker from './Partials/editor/CollagePicker';
import MediaTransformLayer from './Partials/editor/MediaTransformLayer';
import BoomerangPreview from './Partials/BoomerangPreview';
import CollageOverlay from './Partials/overlays/CollageOverlay';
import OverlayRenderer from './Partials/OverlayRenderer';
import GradientOverlay from '@/components/ui/GradientOverlay';
import { resolveAvatarUrl } from '@/components/helpers/helpers';
import { Image as ExpoImage } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');
const TEXT_STORY_COLORS = ['#1c1c1c', '#111111', '#2b2110', '#ffc801', '#3a3a3a'];
const TEXT_STORY_GRADIENTS = [
  ['#1c1c1c', '#111111'],
  ['#ffc801', '#b45309'],
  ['#0f172a', '#1d4ed8'],
  ['#4c1d95', '#db2777'],
  ['#14532d', '#166534'],
];
const STORY_FILTERS = [
  { id: 'none', label: 'Original', color: null, opacity: 0 },
  { id: 'gold', label: 'Gold', color: '#ffc801', opacity: 0.34 },
  { id: 'warm', label: 'Warm', color: '#ff8c3c', opacity: 0.36 },
  { id: 'cool', label: 'Cool', color: '#4c8cff', opacity: 0.32 },
  { id: 'soft', label: 'Soft', color: '#ffffff', opacity: 0.26 },
  { id: 'night', label: 'Night', color: '#0a1028', opacity: 0.42 },
  { id: 'rose', label: 'Rose', color: '#fb7185', opacity: 0.34 },
  { id: 'forest', label: 'Forest', color: '#166534', opacity: 0.38 },
  { id: 'vintage', label: 'Vintage', color: '#d6b48a', opacity: 0.36 },
];

function pickerMediaTypes() {
  return ImagePicker.MediaTypeOptions?.All
    ?? (ImagePicker.MediaType?.All && [ImagePicker.MediaType.Images, ImagePicker.MediaType.Videos])
    ?? ['images', 'videos'];
}

function toDurationMs(raw, isVideo) {
  const fallback = isVideo ? 15000 : 5000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  if (n < 1000) return Math.round(n * 1000);
  return Math.round(n);
}

function toUploadUri(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  if (uri.startsWith('/') && !uri.startsWith('file://')) return `file://${uri}`;
  return uri;
}

/**
 * Story creation screen.
 *
 * Flow:
 *  1. User lands on a black sheet with Camera / Gallery / Text.
 *  2. After picking media (or a text background), they edit overlays.
 *  3. On Send, we upload to /api/mobile/stories and pop back.
 */
export default function CreateStoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAppContext();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();

  const [media, setMedia] = useState(null); // { uri, type, duration, width, height, mimeType }
  const [cameraOpen, setCameraOpen] = useState(false);
  const [collageAssets, setCollageAssets] = useState(null);
  const [sequenceQueue, setSequenceQueue] = useState([]);
  const [transformMode, setTransformMode] = useState(false);
  const [mediaTransform, setMediaTransform] = useState({ x: 0.5, y: 0.5, scale: 1, rotation: 0 });
  const [blurOn, setBlurOn] = useState(false);
  const [gradientIdx, setGradientIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [postingAudience, setPostingAudience] = useState(null); // 'public' | 'close_friends' | null
  const [overlays, setOverlays] = useState([]); // creative layer
  const [selectedOverlayId, setSelectedOverlayId] = useState(null);
  const [textModal, setTextModal] = useState({ open: false, editing: null });
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [interactiveOpen, setInteractiveOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  /** When set, picking a user replaces this mention overlay instead of adding a new one. */
  const [mentionEditingId, setMentionEditingId] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [caption, setCaption] = useState('');
  const videoRef = useRef(null);
  const uploadingRef = useRef(false);
  const previewSoundRef = useRef(null);
  const hasMusicOverlay = overlays.some((o) => o.type === 'music');

  // Ensure audio playback works for video previews even in silent mode.
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'duckOthers',
        });
      } catch (_) {}
    })();
  }, []);

  // Preview the selected music track in the editor so the creator hears
  // exactly what will play on the story. Re-creates the player whenever
  // the music overlay's preview_url or trim range changes. Suspended while
  // the music picker is open (the picker plays its own preview).
  useEffect(() => {
    const musicOverlay = overlays.find((o) => o.type === 'music');
    let cancelled = false;
    let statusSub = null;

    (async () => {
      if (!musicOverlay?.preview_url || musicOpen) {
        if (previewSoundRef.current) {
          try { previewSoundRef.current.pause(); } catch (_) {}
          try { previewSoundRef.current.release(); } catch (_) {}
          previewSoundRef.current = null;
        }
        return;
      }
      // Reload with the current trim
      if (previewSoundRef.current) {
        try { previewSoundRef.current.pause(); } catch (_) {}
        try { previewSoundRef.current.release(); } catch (_) {}
        previewSoundRef.current = null;
      }
      try {
        const player = createAudioPlayer({ uri: musicOverlay.preview_url });
        player.loop = false;
        player.volume = typeof musicOverlay.music_volume === 'number' ? musicOverlay.music_volume : 0.85;
        const start = musicOverlay.start_ms || 0;
        player.seekTo(start / 1000);
        player.play();
        if (cancelled) {
          try { player.pause(); } catch (_) {}
          try { player.release(); } catch (_) {}
          return;
        }
        previewSoundRef.current = player;

        // Manually loop the [start_ms, end_ms] window.
        statusSub = player.addListener('playbackStatusUpdate', (status) => {
          if (!status?.isLoaded) return;
          const storyEnd = musicOverlay.end_ms || 60000;
          const previewEnd = Math.min(start + 30000, storyEnd);
          const positionMs = (status.currentTime || 0) * 1000;
          if (status.didJustFinish || positionMs >= previewEnd - 50) {
            player.seekTo(start / 1000);
            player.play();
          }
        });
      } catch (_) {
        // Silently ignore; the creator will still see the sticker.
      }
    })();

    return () => {
      cancelled = true;
      if (statusSub) {
        try { statusSub.remove(); } catch (_) {}
      }
    };
  }, [overlays.find((o) => o.type === 'music')?.preview_url,
      overlays.find((o) => o.type === 'music')?.start_ms,
      overlays.find((o) => o.type === 'music')?.end_ms,
      overlays.find((o) => o.type === 'music')?.music_volume,
      musicOpen]);

  useEffect(() => {
    const image = typeof params.postImage === 'string' ? params.postImage : '';
    const text = typeof params.postText === 'string' ? params.postText : '';
    if (!image && !text) return;
    if (image) {
      setMedia({
        uri: image,
        type: 'image',
        durationMs: 5000,
        mimeType: 'image/jpeg',
      });
    } else {
      setMedia({
        type: 'text',
        uri: null,
        durationMs: 5000,
        bgColor: TEXT_STORY_COLORS[0],
      });
    }
    if (text.trim()) {
      setOverlays((prev) => {
        if (prev.some((o) => o.type === 'text' && o.text === text.trim())) return prev;
        return [...prev, {
          id: `${Date.now().toString(36)}_post`,
          type: 'text',
          x: 0.5,
          y: 0.72,
          scale: 1,
          rotation: 0,
          text: text.trim().slice(0, 300),
          color: '#ffffff',
          has_bg: true,
          bg_color: '#ffc801',
          font: 'default',
          align: 'center',
          anim: 'none',
        }];
      });
    }
  }, [params.postImage, params.postText]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (previewSoundRef.current) {
        try { previewSoundRef.current.pause(); } catch (_) {}
        try { previewSoundRef.current.release(); } catch (_) {}
        previewSoundRef.current = null;
      }
    };
  }, []);

  const normaliseAsset = (asset) => {
    if (!asset) return null;
    const uri = asset.uri || asset.localUri;
    if (!uri) return null;
    const mime = String(asset.mimeType || asset.type || '');
    const isVideo = mime.startsWith('video')
      || asset.type === 'video'
      || asset.type === 'pairedVideo'
      || /\.(mp4|mov|m4v|webm|mkv)$/i.test(uri);
    return {
      uri,
      type: isVideo ? 'video' : 'image',
      durationMs: toDurationMs(asset.duration, isVideo),
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType,
    };
  };

  const pickerOptions = {
    mediaTypes: pickerMediaTypes(),
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 0.85,
    videoMaxDuration: 60,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode?.Compatible
      ?? 'compatible',
  };

  const applyPickedAssets = useCallback((assets) => {
    const list = (assets || []).map(normaliseAsset).filter(Boolean);
    if (!list.length) return;
    if (list.length === 1) {
      setMedia(list[0]);
      setSequenceQueue([]);
      return;
    }
    if (list.length <= 4 && list.every((a) => a.type === 'image')) {
      setCollageAssets(list);
      return;
    }
    setMedia(list[0]);
    setSequenceQueue(list.slice(1));
  }, []);

  const pickFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'We need access to your media library.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (result?.canceled) return;
      applyPickedAssets(result.assets);
      setCameraOpen(false);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not pick media.');
    }
  }, [applyPickedAssets]);

  const captureFromCamera = useCallback(() => {
    setCameraOpen(true);
  }, []);

  const onCameraCapture = useCallback((asset) => {
    setCameraOpen(false);
    if (!asset) return;
    if (asset.type === 'boomerang') {
      setMedia({
        ...asset,
        type: 'boomerang',
        uri: asset.uri || asset.frames?.[0],
        frames: asset.frames || [],
        durationMs: 4000,
      });
      return;
    }
    setMedia(normaliseAsset(asset) || asset);
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Overlay management
  // ────────────────────────────────────────────────────────────────────
  const makeId = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const addTextOverlay = useCallback((data) => {
    if (textModal.editing) {
      setOverlays((prev) => prev.map((o) => o.id === textModal.editing.id ? {
        ...o,
        text: data.text,
        color: data.color,
        has_bg: data.has_bg,
        bg_color: data.bg_color,
        font: data.font || o.font || 'default',
        align: data.align || o.align || 'center',
        anim: data.anim || o.anim || 'none',
      } : o));
    } else {
      const o = {
        id: makeId(),
        type: 'text',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        text: data.text,
        color: data.color,
        has_bg: data.has_bg,
        bg_color: data.bg_color,
        font: data.font || 'default',
        align: data.align || 'center',
        anim: data.anim || 'none',
      };
      setOverlays((prev) => [...prev, o]);
      setSelectedOverlayId(o.id);
    }
    setTextModal({ open: false, editing: null });
  }, [textModal.editing]);

  const addStickerOverlay = useCallback((emoji) => {
    const o = {
      id: makeId(),
      type: 'sticker',
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      emoji,
    };
    setOverlays((prev) => [...prev, o]);
    setSelectedOverlayId(o.id);
  }, []);

  const addImageSticker = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? ['images'],
        quality: 0.8,
        allowsEditing: false,
      });
      if (result?.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;
      const o = {
        id: makeId(),
        type: 'sticker',
        x: 0.5,
        y: 0.5,
        scale: 1.4,
        rotation: 0,
        image_uri: uri,
        mimeType: result.assets?.[0]?.mimeType || 'image/jpeg',
      };
      setOverlays((prev) => [...prev, o]);
      setSelectedOverlayId(o.id);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not add sticker.');
    }
  }, []);

  const addCutoutSticker = useCallback(() => {
    if (!media?.uri || (media.type !== 'image' && media.type !== 'boomerang')) {
      Alert.alert('Cutout', 'Take or pick a photo first.');
      return;
    }
    const o = {
      id: makeId(),
      type: 'sticker',
      x: 0.5,
      y: 0.42,
      scale: 1.8,
      rotation: 0,
      image_uri: media.uri,
      cutout: true,
      mimeType: media.mimeType || 'image/jpeg',
    };
    setOverlays((prev) => [...prev, o]);
    setSelectedOverlayId(o.id);
  }, [media]);

  const addMentionOverlay = useCallback((user) => {
    if (!user?.id) return;
    const displayName = (user.name || 'User').trim();
    const editId = mentionEditingId;

    if (editId) {
      setOverlays((prev) => prev.map((o) => (
        o.id === editId && o.type === 'mention'
          ? { ...o, user_id: user.id, username: displayName, hidden: o.hidden !== false }
          : o
      )));
      setSelectedOverlayId(editId);
    } else {
      const newId = makeId();
      const o = {
        id: newId,
        type: 'mention',
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        user_id: user.id,
        username: displayName,
        color: '#ffffff',
        has_bg: false,
        bg_color: null,
        hidden: false,
      };
      setOverlays((prev) => [...prev, o]);
      setSelectedOverlayId(newId);
    }
    setMentionEditingId(null);
    setMentionOpen(false);
  }, [mentionEditingId]);

  const openMentionPicker = useCallback(() => {
    setMentionEditingId(null);
    setMentionOpen(true);
  }, []);

  const editMentionOverlay = useCallback((overlay) => {
    if (overlay?.type === 'mention' && overlay?.id) {
      setMentionEditingId(overlay.id);
      setMentionOpen(true);
    }
  }, []);

  const addMusicOverlay = useCallback((data) => {
    if (!data?.track_id) return;
    // Replace existing music overlay if present (one track per story).
    const disp = data.display ?? 'none';
    const o = {
      id: makeId(),
      type: 'music',
      // Sound-only: tiny editor handle top-right; stickers default near top center.
      x: disp === 'none' ? 0.88 : 0.5,
      y: disp === 'none' ? 0.2 : 0.18,
      scale: 1,
      rotation: 0,
      track_id:    data.track_id,
      title:       data.title,
      artist:      data.artist,
      album:       data.album,
      cover_url:   data.cover_url,
      preview_url: data.preview_url || null,
      duration_ms: data.duration_ms || null,
      start_ms:    data.start_ms ?? 0,
      end_ms:      data.end_ms ?? data.story_clip_ms ?? 60000,
      display:     disp,
      source: data.source || 'user',
      local_uri: data.source === 'user' ? (data.local_uri || data.preview_url || null) : null,
      mimeType: data.mimeType || null,
      original_volume: typeof data.original_volume === 'number' ? data.original_volume : 0,
      music_volume: typeof data.music_volume === 'number' ? data.music_volume : 0.85,
    };
    setOverlays((prev) => {
      const withoutMusic = prev.filter((p) => p.type !== 'music');
      return [...withoutMusic, o];
    });
    setSelectedOverlayId(o.id);
    setMusicOpen(false);
  }, []);

  const commitDrawingStrokes = useCallback((strokes) => {
    setDrawingMode(false);
    if (Array.isArray(strokes) && strokes.length > 0) {
      // Drawings stack underneath text/stickers so creative items stay on top.
      setOverlays((prev) => {
        const drawings = prev.filter((o) => o.type === 'drawing');
        const others = prev.filter((o) => o.type !== 'drawing');
        return [...drawings, ...strokes, ...others];
      });
    }
  }, []);

  const patchOverlay = useCallback((id, patch) => {
    setOverlays((prev) => prev.map((o) => o.id === id ? { ...o, ...patch } : o));
  }, []);

  const deleteOverlay = useCallback((id) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedOverlayId((cur) => (cur === id ? null : cur));
  }, []);

  const editTextOverlay = useCallback((overlay) => {
    setTextModal({ open: true, editing: overlay });
  }, []);

  const applyFilter = useCallback((filter) => {
    setOverlays((prev) => {
      const without = prev.filter((o) => o.type !== 'filter');
      if (!filter?.color) return without;
      return [{
        id: 'filter_main',
        type: 'filter',
        name: filter.id,
        color: filter.color,
        opacity: filter.opacity,
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
      }, ...without];
    });
  }, []);

  const currentFilterId = overlays.find((o) => o.type === 'filter')?.name || 'none';

  const undoLastOverlay = useCallback(() => {
    setOverlays((prev) => prev.slice(0, -1));
    setSelectedOverlayId(null);
  }, []);

  // Always land on the home tab after create.
  // back() only pops create and leaves the hidden stories tab focused.
  const leaveCreateToHome = useCallback(() => {
    setMedia(null);
    setOverlays([]);
    setSelectedOverlayId(null);
    setSequenceQueue([]);
    setCollageAssets(null);
    setTransformMode(false);
    setFiltersOpen(false);
    setToolsExpanded(false);

    try {
      if (expoRouter.canDismiss?.()) {
        expoRouter.dismiss();
      }
    } catch (_) {}

    try {
      expoRouter.replace('/(tabs)/home');
    } catch (_) {
      try { expoRouter.navigate('/(tabs)/home'); } catch (__) {}
    }
  }, []);

  const submit = useCallback(async (audienceChoice = 'public') => {
    if (!media || !token || uploading || uploadingRef.current) return;
    const isText = media.type === 'text';
    const isCollage = media.type === 'collage';
    const isBoomerang = media.type === 'boomerang';
    if (!isText && !isCollage && !media.uri) return;
    uploadingRef.current = true;
    setUploading(true);
    setPostingAudience(audienceChoice);
    try {
      const extraOverlays = [];
      if (mediaTransform && (mediaTransform.scale !== 1 || mediaTransform.rotation !== 0 || mediaTransform.x !== 0.5 || mediaTransform.y !== 0.5)) {
        extraOverlays.push({ id: 'media_transform', type: 'media_transform', ...mediaTransform });
      }
      if (blurOn) extraOverlays.push({ id: 'blur_main', type: 'blur', intensity: 16, x: 0.5, y: 0.5, scale: 1, rotation: 0 });
      if (isText && TEXT_STORY_GRADIENTS[gradientIdx]) {
        extraOverlays.push({
          id: 'gradient_bg',
          type: 'gradient',
          colors: TEXT_STORY_GRADIENTS[gradientIdx],
          x: 0.5, y: 0.5, scale: 1, rotation: 0,
        });
      }
      if (isCollage && media.template && Array.isArray(media.cells)) {
        extraOverlays.push({
          id: 'layout_main',
          type: 'layout',
          template: media.template,
          cells: media.cells.map((c) => ({ uri: c.uri })),
          x: 0.5, y: 0.5, scale: 1, rotation: 0,
        });
      }
      if (isBoomerang && Array.isArray(media.frames) && media.frames.length) {
        extraOverlays.push({
          id: 'boomerang_main',
          type: 'boomerang',
          frames: media.frames,
          x: 0.5, y: 0.5, scale: 1, rotation: 0,
        });
      }

      const merged = [...extraOverlays, ...overlays];
      const stickerFiles = {};
      const layoutFiles = [];
      const cleanOverlays = merged.map((overlay, idx) => {
        const {
          _measuredWidth,
          _measuredHeight,
          measured_width,
          measured_height,
          local_uri,
          mimeType: overlayMime,
          image_uri,
          ...rest
        } = overlay;
        const next = { ...rest };
        const mw = measured_width || _measuredWidth;
        const mh = measured_height || _measuredHeight;
        if (mw) next.measured_width = mw;
        if (mh) next.measured_height = mh;
        if (overlay.type === 'sticker' && image_uri) {
          stickerFiles[overlay.id] = {
            uri: toUploadUri(image_uri),
            name: `sticker_${overlay.id}.jpg`,
            mimeType: overlayMime || 'image/jpeg',
          };
        }
        if (overlay.type === 'layout' && Array.isArray(overlay.cells)) {
          overlay.cells.forEach((cell, i) => {
            const uri = cell.uri || cell.image_uri;
            if (uri) {
              layoutFiles[i] = {
                uri: toUploadUri(uri),
                name: `layout_${i}.jpg`,
                mimeType: 'image/jpeg',
              };
            }
          });
        }
        return next;
      });
      const music = overlays.find((o) => o.type === 'music');
      const audioUri = music?.source === 'user'
        ? (music?.local_uri || music?.preview_url)
        : null;
      const queue = [media, ...sequenceQueue];

      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        const itemText = item.type === 'text' || item.type === 'collage';
        await API.createStory({
          uri: itemText ? undefined : toUploadUri(item.uri || item.frames?.[0]),
          type: item.type === 'video' ? 'video' : 'image',
          durationMs: toDurationMs(item.durationMs, item.type === 'video'),
          width: item.width,
          height: item.height,
          mimeType: item.mimeType,
          audience: audienceChoice,
          overlays: i === 0 ? cleanOverlays : [],
          textStory: itemText,
          bgColor: item.bgColor || (itemText ? '#111111' : undefined),
          audio: i === 0 && audioUri ? {
            uri: toUploadUri(audioUri),
            name: music?.title ? `${String(music.title).replace(/[^\w.-]+/g, '_')}.m4a` : 'story_audio.m4a',
            mimeType: music?.mimeType || 'audio/mpeg',
          } : undefined,
          stickers: i === 0 ? stickerFiles : undefined,
          layoutCells: i === 0 ? layoutFiles : undefined,
          boomerang: i === 0 && isBoomerang ? (item.frames || []).map((uri, fi) => ({
            uri: toUploadUri(uri),
            name: `boom_${fi}.jpg`,
            mimeType: 'image/jpeg',
          })) : undefined,
        }, token);
      }
      // Close create and land on home.
      // Do NOT use dismissTo(home) here — home isn't in this stack, so Expo
      // Router treats it as a push and can leave you stuck on create.
      leaveCreateToHome();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'Upload failed';
      Alert.alert('Could not post story', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: () => submit(audienceChoice) },
      ]);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      setPostingAudience(null);
    }
  }, [media, token, overlays, uploading, sequenceQueue, mediaTransform, blurOn, gradientIdx, leaveCreateToHome]);

  const close = () => leaveCreateToHome();
  const discard = () => {
    setMedia(null);
    setOverlays([]);
    setSelectedOverlayId(null);
    setCaption('');
    setSequenceQueue([]);
    setCollageAssets(null);
    setTransformMode(false);
    setMediaTransform({ x: 0.5, y: 0.5, scale: 1, rotation: 0 });
    setBlurOn(false);
    setFiltersOpen(false);
    setToolsExpanded(false);
  };

  // ────────────────────────────────────────────────────────────────────
  // Preview
  // ────────────────────────────────────────────────────────────────────
  if (media) {
    const statusTop = Math.max(insets.top || 0, Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24);
    const footerBottom = Math.max(insets.bottom, 12) + 8;
    const avatarUrl = resolveAvatarUrl(user?.avatar || user?.image || user?.profile_picture);
    const musicMix = overlays.find((o) => o.type === 'music');
    const origVol = typeof musicMix?.original_volume === 'number' ? musicMix.original_volume : (musicMix ? 0 : 1);
    const photoUri = media.type === 'image' ? toUploadUri(media.uri) : null;
    const filterOverlay = overlays.find((o) => o.type === 'filter');

    const mediaEffects = (
      <>
        {blurOn ? (
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFillObject} />
        ) : null}
        {filterOverlay?.color ? (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              backgroundColor: filterOverlay.color,
              opacity: typeof filterOverlay.opacity === 'number' ? filterOverlay.opacity : 0.3,
            }}
          />
        ) : null}
      </>
    );

    let mediaNode = <View style={{ flex: 1, backgroundColor: '#111' }} />;
    if (photoUri) {
      const photo = (
        <View style={{ flex: 1, backgroundColor: '#111' }} collapsable={false}>
          <ExpoImage
            source={{ uri: photoUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
          {mediaEffects}
        </View>
      );
      mediaNode = transformMode && !drawingMode ? (
        <MediaTransformLayer
          enabled
          transform={mediaTransform}
          onChange={setMediaTransform}
        >
          {photo}
        </MediaTransformLayer>
      ) : (
        photo
      );
    } else if (media.type === 'video') {
      const video = (
        <View style={{ flex: 1, backgroundColor: '#000' }} collapsable={false}>
          <StoryVideo
            uri={media.uri}
            style={{ width: '100%', height: '100%' }}
            shouldPlay
            isLooping
            muted={origVol <= 0.01}
            volume={origVol}
            playerRef={videoRef}
            surfaceType="textureView"
          />
          {mediaEffects}
        </View>
      );
      mediaNode = transformMode && !drawingMode ? (
        <MediaTransformLayer
          enabled
          transform={mediaTransform}
          onChange={setMediaTransform}
        >
          {video}
        </MediaTransformLayer>
      ) : (
        video
      );
    } else if (media.type === 'boomerang') {
      mediaNode = (
        <View style={{ flex: 1, backgroundColor: '#111' }}>
          <BoomerangPreview
            frames={media.frames || [media.uri]}
            style={StyleSheet.absoluteFillObject}
          />
          {mediaEffects}
        </View>
      );
    } else if (media.type === 'text') {
      mediaNode = (
        <LinearGradient
          colors={TEXT_STORY_GRADIENTS[gradientIdx] || ['#1c1c1c', '#111111']}
          style={{ flex: 1 }}
        >
          {mediaEffects}
        </LinearGradient>
      );
    } else if (media.type === 'collage') {
      mediaNode = (
        <View style={{ flex: 1, backgroundColor: '#111' }}>
          <CollageOverlay
            overlay={{ template: media.template, cells: (media.cells || []).map((c) => ({ image_uri: c.uri })) }}
            containerSize={canvasSize.width ? canvasSize : { width: WINDOW_W, height: WINDOW_H }}
          />
          {mediaEffects}
        </View>
      );
    }

    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
        <StatusBar style="light" />

        {/* Media canvas — keep native image/video here only */}
        <View
          style={{ flex: 1, backgroundColor: '#000' }}
          collapsable={false}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== canvasSize.width || height !== canvasSize.height) {
              setCanvasSize({ width, height });
            }
          }}
        >
          {mediaNode}
          <View pointerEvents="box-none" style={styles.creativeOverlay}>
            <OverlayRenderer overlays={overlays.filter((o) => o.type === 'drawing')} />
            {!drawingMode && !transformMode ? (
              <EditableOverlayLayer
                overlays={overlays}
                containerSize={canvasSize}
                selectedId={selectedOverlayId}
                onSelect={setSelectedOverlayId}
                onDeselect={() => setSelectedOverlayId(null)}
                onUpdate={patchOverlay}
                onDelete={deleteOverlay}
                onEditText={editTextOverlay}
                onEditMention={editMentionOverlay}
              />
            ) : null}
            <DrawingCanvas
              visible={drawingMode}
              containerSize={canvasSize}
              existingDrawings={overlays.filter((o) => o.type === 'drawing')}
              onCancel={() => setDrawingMode(false)}
              onCommit={commitDrawingStrokes}
            />
          </View>
        </View>

        {/*
          Controls as ROOT siblings of the canvas.
          Android native media surfaces ignore zIndex of overlays nested inside them.
        */}
        {!drawingMode ? (
          <>
            <Pressable
              onPress={discard}
              disabled={uploading}
              accessibilityLabel="Cancel story"
              hitSlop={10}
              style={[styles.cancelBtn, { top: statusTop + 10, opacity: uploading ? 0.5 : 1 }]}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>

            <View
              style={[
                styles.sideRail,
                {
                  top: statusTop + 10,
                  bottom: footerBottom + 96,
                },
              ]}
            >
              <SideAction
                label="Text"
                onPress={() => { setFiltersOpen(false); setTextModal({ open: true, editing: null }); }}
                accessibilityLabel="Add text"
              >
                <Text style={styles.sideAa}>Aa</Text>
              </SideAction>
              <SideAction
                label="Stickers"
                onPress={() => { setFiltersOpen(false); setEmojiOpen(true); }}
                accessibilityLabel="Add sticker"
              >
                <Ionicons name="happy-outline" size={22} color="#fff" />
              </SideAction>
              <SideAction
                label="Audio"
                onPress={() => { setFiltersOpen(false); setMusicOpen(true); }}
                accessibilityLabel="Add music"
                active={hasMusicOverlay}
              >
                <Ionicons name="musical-notes" size={20} color="#fff" />
              </SideAction>
              <SideAction
                label="Effects"
                onPress={() => setFiltersOpen((v) => !v)}
                accessibilityLabel="Filters and effects"
                active={filtersOpen || currentFilterId !== 'none'}
              >
                <Ionicons name="sparkles" size={20} color="#fff" />
              </SideAction>

              {toolsExpanded ? (
                <>
                  <SideAction
                    label="Saved"
                    onPress={() => { setFiltersOpen(false); setInteractiveOpen(true); }}
                    accessibilityLabel="Add poll or sticker"
                  >
                    <Ionicons name="bookmark-outline" size={20} color="#fff" />
                  </SideAction>
                  <SideAction
                    label="Mention"
                    onPress={() => { setFiltersOpen(false); openMentionPicker(); }}
                    accessibilityLabel="Mention someone"
                  >
                    <Text style={styles.sideAt}>@</Text>
                  </SideAction>
                  <SideAction
                    label="Draw"
                    onPress={() => { setFiltersOpen(false); setDrawingMode(true); }}
                    accessibilityLabel="Draw"
                  >
                    <Ionicons name="brush-outline" size={20} color="#fff" />
                  </SideAction>
                  <SideAction
                    label="Photo"
                    onPress={() => { setFiltersOpen(false); addImageSticker(); }}
                    accessibilityLabel="Add photo sticker"
                  >
                    <Ionicons name="image-outline" size={20} color="#fff" />
                  </SideAction>
                  {(media.type === 'image' || media.type === 'boomerang') ? (
                    <SideAction
                      label="Crop"
                      onPress={() => { setFiltersOpen(false); addCutoutSticker(); }}
                      accessibilityLabel="Crop to sticker"
                    >
                      <Ionicons name="scan-outline" size={20} color="#fff" />
                    </SideAction>
                  ) : null}
                  {media.type !== 'text' && media.type !== 'collage' ? (
                    <SideAction
                      label="Move"
                      onPress={() => setTransformMode((v) => !v)}
                      accessibilityLabel="Move media"
                      active={transformMode}
                    >
                      <Ionicons name="move-outline" size={20} color="#fff" />
                    </SideAction>
                  ) : null}
                  <SideAction
                    label="Blur"
                    onPress={() => setBlurOn((v) => !v)}
                    accessibilityLabel="Blur wash"
                    active={blurOn}
                  >
                    <Ionicons name="water-outline" size={20} color="#fff" />
                  </SideAction>
                  {media.type === 'text' ? (
                    <SideAction
                      label="Color"
                      onPress={() => {
                        setGradientIdx((i) => (i + 1) % TEXT_STORY_GRADIENTS.length);
                        const next = TEXT_STORY_COLORS[(TEXT_STORY_COLORS.indexOf(media.bgColor || TEXT_STORY_COLORS[0]) + 1) % TEXT_STORY_COLORS.length];
                        setMedia((m) => (m ? { ...m, bgColor: next } : m));
                      }}
                      accessibilityLabel="Change background"
                    >
                      <Ionicons name="color-palette-outline" size={20} color="#fff" />
                    </SideAction>
                  ) : null}
                  {overlays.length > 0 ? (
                    <SideAction label="Undo" onPress={undoLastOverlay} accessibilityLabel="Undo last">
                      <Ionicons name="arrow-undo" size={20} color="#fff" />
                    </SideAction>
                  ) : null}
                </>
              ) : null}

              <SideAction
                onPress={() => setToolsExpanded((v) => !v)}
                accessibilityLabel={toolsExpanded ? 'Show fewer tools' : 'Show more tools'}
                compact
              >
                <Ionicons name={toolsExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
              </SideAction>
            </View>

            {hasMusicOverlay && !filtersOpen ? (
              <View style={[styles.mixRow, { bottom: footerBottom + 118 }]}>
                {[['original_volume', 'Original'], ['music_volume', 'Audio']].map(([key, label]) => {
                  const music = overlays.find((o) => o.type === 'music');
                  const val = typeof music?.[key] === 'number' ? music[key] : (key === 'original_volume' ? 0 : 0.85);
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        const next = val < 0.34 ? 0.5 : val < 0.84 ? 1 : 0;
                        setOverlays((prev) => prev.map((o) => (o.type === 'music' ? { ...o, [key]: next } : o)));
                      }}
                      style={styles.mixChip}
                    >
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{label} {Math.round(val * 100)}%</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {filtersOpen ? (
              <View style={[styles.filtersPanel, { bottom: footerBottom + 100 }]}>
                <Text style={styles.filtersTitle}>Effects</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 14, gap: 12, alignItems: 'center', paddingBottom: 4 }}
                >
                  {STORY_FILTERS.map((f) => {
                    const active = currentFilterId === f.id;
                    return (
                      <Pressable
                        key={f.id}
                        onPress={() => applyFilter(f)}
                        accessibilityLabel={`Filter ${f.label}`}
                        style={{ alignItems: 'center', width: 68 }}
                      >
                        <View style={[styles.filterThumb, active && styles.filterThumbActive]}>
                          {media?.uri && media.type !== 'text' ? (
                            <Image
                              source={{ uri: media.uri }}
                              style={StyleSheet.absoluteFillObject}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#333' }]} />
                          )}
                          {f.color ? (
                            <View
                              pointerEvents="none"
                              style={[StyleSheet.absoluteFillObject, { backgroundColor: f.color, opacity: Math.min(0.55, (f.opacity || 0.2) + 0.15) }]}
                            />
                          ) : null}
                        </View>
                        <Text style={[styles.filterLabel, active && styles.filterLabelActive]} numberOfLines={1}>
                          {f.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {!filtersOpen ? (
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255,255,255,0.85)"
                style={[styles.captionInput, { position: 'absolute', left: 16, right: 70, bottom: footerBottom + 72, zIndex: 60, elevation: 60 }]}
                multiline
                maxLength={220}
              />
            ) : null}

            <View style={[styles.postBar, { bottom: footerBottom }]}>
              <Pressable
                onPress={() => submit('public')}
                disabled={uploading}
                accessibilityLabel="Post to your stories"
                style={({ pressed }) => [
                  styles.audiencePill,
                  pressed && !uploading && styles.pillPressed,
                  uploading && postingAudience !== 'public' && styles.pillDisabled,
                ]}
              >
                <View style={styles.pillRow}>
                  {uploading && postingAudience === 'public' ? (
                    <ActivityIndicator size="small" color="#fff" style={styles.pillSpinner} />
                  ) : (
                    <View style={styles.avatarWrap}>
                      <View style={styles.avatarRing}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Ionicons name="person" size={16} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={styles.avatarBadge}>
                        <Image
                          source={require('@/assets/images/icon.png')}
                          style={styles.avatarBadgeImage}
                        />
                      </View>
                    </View>
                  )}
                  <Text style={styles.audiencePillText} numberOfLines={1}>Your stories</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => submit('close_friends')}
                onLongPress={() => router.push('/(tabs)/settings/close-friends')}
                delayLongPress={350}
                disabled={uploading}
                accessibilityLabel="Post to close friends"
                style={({ pressed }) => [
                  styles.audiencePill,
                  pressed && !uploading && styles.pillPressed,
                  uploading && postingAudience !== 'close_friends' && styles.pillDisabled,
                ]}
              >
                <View style={styles.pillRow}>
                  {uploading && postingAudience === 'close_friends' ? (
                    <ActivityIndicator size="small" color="#fff" style={styles.pillSpinner} />
                  ) : (
                    <View style={styles.closeFriendsIcon}>
                      <Ionicons name="star" size={15} color="#fff" />
                    </View>
                  )}
                  <Text style={styles.audiencePillText} numberOfLines={1}>Close Friends</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : null}

        <TextInputModal
          visible={textModal.open}
          initial={textModal.editing || null}
          onCancel={() => setTextModal({ open: false, editing: null })}
          onSubmit={addTextOverlay}
        />
        <EmojiPickerSheet
          visible={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onPick={addStickerOverlay}
        />
        <UserPickerSheet
          visible={mentionOpen}
          onClose={() => { setMentionOpen(false); setMentionEditingId(null); }}
          onPick={addMentionOverlay}
        />
        <MusicPickerSheet
          visible={musicOpen}
          onClose={() => setMusicOpen(false)}
          onPick={addMusicOverlay}
        />
        <InteractiveStickerSheet
          visible={interactiveOpen}
          onClose={() => setInteractiveOpen(false)}
          onPick={(overlay) => {
            setOverlays((prev) => [...prev, overlay]);
            setSelectedOverlayId(overlay.id);
          }}
        />
      </GestureHandlerRootView>
    );
  }

  // ────────────────────────────────────────────────────────────────────
  // Picker (initial sheet)
  // ────────────────────────────────────────────────────────────────────
  if (cameraOpen) {
    return (
      <CameraCapture
        onCapture={onCameraCapture}
        onCancel={() => setCameraOpen(false)}
        onOpenGallery={pickFromGallery}
      />
    );
  }

  if (collageAssets) {
    return (
      <CollagePicker
        assets={collageAssets}
        onCancel={() => setCollageAssets(null)}
        onConfirm={({ template, assets }) => {
          setCollageAssets(null);
          setMedia({
            type: 'collage',
            uri: assets[0]?.uri,
            template,
            cells: assets,
            durationMs: 5000,
            bgColor: '#111111',
          });
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#050508' }}>
      <StatusBar style="light" />

      <GradientOverlay
        colors={['rgba(255,200,1,0.12)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
        stops={[0, 0.45, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <Pressable
        onPress={close}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6,
          left: 16,
          zIndex: 2,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1.5,
          borderColor: 'rgba(255,200,1,0.35)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: '#ffc801',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 22,
          borderWidth: 3,
          borderColor: 'rgba(0,0,0,0.15)',
          shadowColor: '#ffc801',
          shadowOpacity: 0.45,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 12,
        }}
        >
          <Ionicons name="camera" size={40} color="#000" />
        </View>

        <Text style={{ color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 }}>
          New story
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 10, textAlign: 'center', fontSize: 15, lineHeight: 22, fontWeight: '500' }}>
          Pick a photo, video, or text. It disappears after 24 hours.
        </Text>

        <View style={{ width: '100%', marginTop: 40, gap: 14 }}>
          <Pressable
            onPress={captureFromCamera}
            style={({ pressed }) => ({
              paddingVertical: 18,
              borderRadius: 18,
              backgroundColor: pressed ? 'rgba(255,200,1,0.18)' : 'rgba(255,255,255,0.07)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderWidth: 1.5,
              borderColor: pressed ? 'rgba(255,200,1,0.45)' : 'rgba(255,255,255,0.14)',
            })}
          >
            <Ionicons name="camera-outline" size={22} color="#ffc801" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Camera</Text>
          </Pressable>

          <Pressable
            onPress={pickFromGallery}
            style={({ pressed }) => ({
              paddingVertical: 18,
              borderRadius: 18,
              backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.12)',
            })}
          >
            <Ionicons name="images-outline" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Gallery</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMedia({
                type: 'text',
                uri: null,
                durationMs: 5000,
                bgColor: TEXT_STORY_COLORS[0],
              });
              setTextModal({ open: true, editing: null });
            }}
            style={({ pressed }) => ({
              paddingVertical: 18,
              borderRadius: 18,
              backgroundColor: pressed ? 'rgba(255,200,1,0.18)' : 'rgba(255,255,255,0.05)',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              borderWidth: 1.5,
              borderColor: pressed ? 'rgba(255,200,1,0.45)' : 'rgba(255,255,255,0.12)',
            })}
          >
            <Text style={{ color: '#ffc801', fontWeight: '900', fontSize: 18 }}>Aa</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>Text</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Semi-transparent circular tool button (legacy). */
function EditorToolButton({ children, onPress, disabled, active, accessibilityLabel, variant }) {
  const bar = variant === 'bar';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        bar ? styles.toolButtonBar : styles.toolButton,
        active && (bar ? styles.toolButtonBarActive : styles.toolButtonActive),
        disabled && styles.toolButtonDisabled,
        pressed && !disabled && styles.toolButtonPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

/** Circular side action — icon only (label kept for a11y). */
function SideAction({ label, children, onPress, active, accessibilityLabel, compact }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel || label}
      hitSlop={4}
      style={({ pressed }) => [
        pressed && styles.toolButtonPressed,
      ]}
    >
      <View style={[
        compact ? styles.sideCircleCompact : styles.sideCircle,
        active && styles.sideCircleActive,
      ]}>
        {children}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  creativeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cancelBtn: {
    position: 'absolute',
    left: 14,
    zIndex: 999,
    elevation: 999,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sideRail: {
    position: 'absolute',
    right: 10,
    width: 48,
    zIndex: 999,
    elevation: 999,
    alignItems: 'center',
    gap: 10,
  },
  mixRow: {
    position: 'absolute',
    left: 12,
    right: 70,
    zIndex: 50,
    elevation: 50,
    flexDirection: 'row',
    gap: 8,
  },
  sideAction: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sideCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    elevation: 10,
  },
  sideCircleCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginTop: 2,
    alignSelf: 'center',
    elevation: 10,
  },
  sideCircleActive: {
    backgroundColor: 'rgba(255,200,1,0.95)',
  },
  sideAa: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: -0.4,
  },
  sideAt: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 20,
  },
  mixChip: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  filtersPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 50,
    paddingTop: 8,
    paddingBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  filtersTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 16,
    marginBottom: 8,
    opacity: 0.9,
  },
  filterThumb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: '#222',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  filterThumbActive: {
    borderWidth: 3,
    borderColor: '#fff',
  },
  filterLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
  },
  filterLabelActive: {
    color: '#fff',
  },
  toolButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 60,
    elevation: 60,
  },
  toolButtonActive: {
    backgroundColor: 'rgba(255, 200, 1, 0.85)',
  },
  toolButtonDisabled: {
    opacity: 0.45,
  },
  toolButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.95 }],
  },
  featuresBar: {
    position: 'absolute',
    right: 8,
    width: 72,
    zIndex: 80,
    elevation: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(17,17,17,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,200,1,0.4)',
  },
  featuresBarCol: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 8,
    alignItems: 'center',
    flexGrow: 1,
  },
  toolButtonBar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  toolButtonBarActive: {
    backgroundColor: '#ffc801',
  },
  toolAaBar: {
    fontSize: 18,
  },
  toolMentionBar: {
    fontSize: 20,
  },
  toolAa: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 21,
    letterSpacing: -0.5,
  },
  toolMention: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 21,
  },
  captionInput: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
    maxHeight: 72,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  postBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    writingDirection: 'ltr',
  },
  audiencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 52,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pillPressed: {
    opacity: 0.88,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillSpinner: {
    width: 32,
    height: 32,
  },
  audiencePillText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  avatarWrap: {
    width: 34,
    height: 34,
    position: 'relative',
    flexShrink: 0,
  },
  avatarRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffc801',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.55)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeImage: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  closeFriendsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3897F0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 8,
  },
  sendButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
});
