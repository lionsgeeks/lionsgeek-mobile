import { useCallback, useEffect, useRef } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';

/**
 * Full-bleed story / highlight video using expo-video.
 * Exposes pause/play on `playerRef` so gesture handlers can control playback.
 */
export default function StoryVideo({
  uri,
  style,
  muted = false,
  volume = 1,
  shouldPlay = true,
  isLooping = false,
  onReady,
  onEnd,
  onError,
  playerRef: externalPlayerRef,
  /** Android: textureView lets React overlays paint above the video. */
  surfaceType = undefined,
}) {
  const internalRef = useRef(null);
  const readySentRef = useRef(false);
  const onReadyRef = useRef(onReady);
  const onEndRef = useRef(onEnd);
  const onErrorRef = useRef(onError);
  onReadyRef.current = onReady;
  onEndRef.current = onEnd;
  onErrorRef.current = onError;

  const player = useVideoPlayer(uri || null, (p) => {
    p.loop = isLooping;
    p.muted = muted;
    if (typeof volume === 'number') p.volume = volume;
    if (shouldPlay && uri) p.play();
  });

  const markReady = useCallback(() => {
    if (readySentRef.current) return;
    readySentRef.current = true;
    onReadyRef.current?.();
  }, []);

  useEffect(() => {
    readySentRef.current = false;
  }, [uri]);

  useEffect(() => {
    internalRef.current = player;
    if (externalPlayerRef) externalPlayerRef.current = player;
    return () => {
      if (externalPlayerRef?.current === player) {
        externalPlayerRef.current = null;
      }
    };
  }, [player, externalPlayerRef]);

  useEffect(() => {
    player.muted = muted;
    if (typeof volume === 'number') player.volume = volume;
  }, [muted, volume, player]);

  useEffect(() => {
    player.loop = isLooping;
  }, [isLooping, player]);

  useEffect(() => {
    if (!uri) return;
    if (shouldPlay) player.play();
    else player.pause();
  }, [shouldPlay, player, uri]);

  useEffect(() => {
    const endSub = player.addListener('playToEnd', () => {
      if (!isLooping) onEndRef.current?.();
    });
    const statusSub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay') markReady();
      if (status === 'error' || error) {
        markReady();
        onErrorRef.current?.();
      }
    });
    return () => {
      endSub.remove();
      statusSub.remove();
    };
  }, [player, isLooping, markReady]);

  useEffect(() => {
    return () => {
      try { player.pause(); } catch (_) {}
      try { player.muted = true; } catch (_) {}
      try { player.volume = 0; } catch (_) {}
    };
  }, [player]);

  if (!uri) return null;

  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      surfaceType={surfaceType}
      onFirstFrameRender={markReady}
    />
  );
}
