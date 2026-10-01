import { View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import StoryVideo from './StoryVideo';
import BoomerangPreview from './BoomerangPreview';
import CollageOverlay from './overlays/CollageOverlay';

export default function StoryMediaFrame({
  story,
  style,
  videoProps,
  failed = false,
  onImageError,
  onImageLoad,
}) {
  const overlays = Array.isArray(story?.overlays) ? story.overlays : [];
  const boom = overlays.find((o) => o.type === 'boomerang' && Array.isArray(o.frames) && o.frames.length);
  const layout = overlays.find((o) => o.type === 'layout');
  const transform = overlays.find((o) => o.type === 'media_transform');
  const gradient = overlays.find((o) => o.type === 'gradient' && Array.isArray(o.colors) && o.colors.length >= 2);
  const blur = overlays.find((o) => o.type === 'blur');
  const music = overlays.find((o) => o.type === 'music');
  const origVol = typeof music?.original_volume === 'number' ? music.original_volume : (music ? 0 : 1);
  const tStyle = transform ? {
    transform: [
      { translateX: ((transform.x ?? 0.5) - 0.5) * 400 },
      { translateY: ((transform.y ?? 0.5) - 0.5) * 700 },
      { scale: transform.scale ?? 1 },
      { rotate: `${transform.rotation ?? 0}deg` },
    ],
  } : null;

  let inner = null;
  if (boom) {
    inner = <BoomerangPreview frames={boom.frames} style={style} />;
  } else if (layout) {
    inner = <CollageOverlay overlay={layout} containerSize={{ width: style?.width, height: style?.height }} />;
  } else if (gradient) {
    inner = <LinearGradient colors={gradient.colors} style={style} />;
  } else if (story?.media_type === 'video') {
    inner = (
      <StoryVideo
        uri={story.media_url}
        style={style}
        {...videoProps}
        muted={(videoProps?.muted ?? false) || origVol <= 0.01}
        volume={typeof videoProps?.volume === 'number' ? videoProps.volume : origVol}
      />
    );
  } else {
    inner = (
      <Image
        source={{ uri: story.media_url }}
        style={style}
        resizeMode="cover"
        onLoad={onImageLoad}
        onError={onImageError}
      />
    );
  }

  return (
    <View style={[{ overflow: 'hidden' }, tStyle]}>
      {inner}
      {blur ? <BlurView intensity={Math.min(40, blur.intensity || 16)} tint="dark" style={{ position: 'absolute', inset: 0 }} /> : null}
    </View>
  );
}
