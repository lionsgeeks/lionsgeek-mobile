import { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import Skeleton from '@/components/ui/Skeleton';
import { getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { eventsInfoImageSource } from '@/utils/eventsConfig';

export default function EventCoverImage({ uri, height = 128, borderRadius = 0, className = '' }) {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imageSource = eventsInfoImageSource(uri, token);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri, token]);

  if (!uri || failed || !imageSource) {
    return (
      <View
        className={`w-full bg-beta/15 dark:bg-alpha/15 items-center justify-center ${className}`}
        style={{ height, borderRadius }}
      >
        <Ionicons name="calendar" size={height >= 140 ? 40 : 32} color={getAccentIconColor(isDark)} />
      </View>
    );
  }

  return (
    <View className={`w-full ${className}`} style={{ height, borderRadius, overflow: 'hidden' }}>
      <Image
        source={imageSource}
        className="absolute inset-0 w-full h-full"
        style={{ borderRadius }}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {!loaded ? (
        <View className="absolute inset-0 z-10">
          <Skeleton width="100%" height={height} borderRadius={borderRadius} isDark={isDark} />
        </View>
      ) : null}
    </View>
  );
}
