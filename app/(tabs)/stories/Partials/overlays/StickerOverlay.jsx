import { View, Text, Image } from 'react-native';

export default function StickerOverlay({ overlay, containerSize, selected = false, style }) {
  if (!overlay || !containerSize) return null;
  const cx = (overlay.x ?? 0.5) * containerSize.width;
  const cy = (overlay.y ?? 0.5) * containerSize.height;
  const scale = overlay.scale ?? 1;
  const rotation = overlay.rotation ?? 0;
  const size = 56 * scale;
  const imageUri = overlay.image_url || overlay.image_uri;

  if (imageUri) {
    return (
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: cx - size / 2,
            top: cy - size / 2,
            width: size,
            height: size,
            transform: [{ rotate: `${rotation}deg` }],
            overflow: 'hidden',
            borderRadius: overlay.cutout ? size / 2 : 8,
            borderWidth: selected ? 1 : 0,
            borderColor: 'rgba(255,255,255,0.85)',
          },
          style,
        ]}
      >
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: `${rotation}deg` }],
        },
        selected && {
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.85)',
          borderStyle: 'dashed',
          borderRadius: 6,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: size * 0.85,
          lineHeight: size,
          textAlign: 'center',
          textShadowColor: 'rgba(0,0,0,0.35)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        {overlay.emoji}
      </Text>
    </View>
  );
}
