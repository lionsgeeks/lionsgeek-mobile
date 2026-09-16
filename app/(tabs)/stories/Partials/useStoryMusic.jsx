import { useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Loads, loops (within the trimmed start_ms..end_ms window) and plays a
 * story's music overlay using expo-audio. Returns nothing — it's purely a side
 * effect tied to the story's lifecycle.
 *
 *  - Re-creates the player whenever the music overlay (preview_url / trim)
 *    changes, e.g. when navigating to the next story.
 *  - Mutes / unmutes (effectively pause/play) without unloading when
 *    `isPaused` toggles, so resuming feels instant.
 *  - Fully unloads when `enabled` is false (viewer blurred / closing) or
 *    when the story has no music overlay / on unmount.
 *
 * Usage:
 *   const overlay = currentStory?.overlays?.find(o => o.type === 'music');
 *   useStoryMusic(overlay, { isPaused, enabled: isFocused });
 *
 * The story video's audio should be muted whenever a music overlay exists
 * (the caller is responsible for passing `muted` to its video player).
 */
export default function useStoryMusic(musicOverlay, { isPaused = false, enabled = true } = {}) {
  const playerRef = useRef(null);
  const pausedRef = useRef(!!isPaused || !enabled);
  pausedRef.current = !!isPaused || !enabled;

  const overlayId = musicOverlay?.id;
  const previewUrl = musicOverlay?.preview_url;
  const startMs    = musicOverlay?.start_ms ?? 0;
  const endMs      = musicOverlay?.end_ms   ?? 60000;
  const musicVolume = musicOverlay?.music_volume;

  // Configure audio mode once.
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

  // Load / unload when the active music overlay changes, or when the viewer
  // is no longer active (blur / close — Expo Router may keep the screen mounted).
  useEffect(() => {
    let cancelled = false;
    let statusSub = null;

    const unload = () => {
      if (statusSub) {
        try { statusSub.remove(); } catch (_) {}
        statusSub = null;
      }
      if (playerRef.current) {
        try { playerRef.current.pause(); } catch (_) {}
        try { playerRef.current.volume = 0; } catch (_) {}
        try { playerRef.current.release(); } catch (_) {}
        playerRef.current = null;
      }
    };

    (async () => {
      unload();
      if (!enabled || !previewUrl) return;

      try {
        const player = createAudioPlayer({ uri: previewUrl });
        player.loop = false; // we loop the window manually
        player.volume = typeof musicOverlay.music_volume === 'number' ? musicOverlay.music_volume : 1.0;
        player.seekTo(startMs / 1000);

        if (cancelled || pausedRef.current) {
          try { player.pause(); } catch (_) {}
          try { player.release(); } catch (_) {}
          return;
        }

        player.play();
        playerRef.current = player;

        // Loop the preview inside the full song segment on the story.
        // Never restart while the viewer is paused / closing.
        statusSub = player.addListener('playbackStatusUpdate', (status) => {
          if (pausedRef.current || cancelled) return;
          if (!status?.isLoaded) return;
          const previewEnd = Math.min(startMs + 30000, endMs);
          const positionMs = (status.currentTime ?? 0) * 1000;
          if (status.didJustFinish || positionMs >= previewEnd - 50) {
            try {
              player.seekTo(startMs / 1000);
              if (!pausedRef.current && !cancelled) player.play();
            } catch (_) {}
          }
        });
      } catch (_) {
        // Best-effort — silently skip on failure.
      }
    })();

    return () => {
      cancelled = true;
      unload();
    };
    // Re-create when the *track* changes; the same track stays loaded
    // across simple pause toggles. Including startMs/endMs so retrimming
    // via remote-update (rare) is honoured. `enabled` tears down on blur/close.
  }, [overlayId, previewUrl, startMs, endMs, musicVolume, enabled]);

  // Pause / resume — instant, doesn't tear down audio (unless enabled=false,
  // which is handled by the load effect above).
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      if (isPaused || !enabled) {
        player.pause();
      } else {
        player.play();
      }
    } catch (_) {}
  }, [isPaused, enabled, previewUrl]);
}
