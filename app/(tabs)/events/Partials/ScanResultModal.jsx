import { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Overlays } from '@/constants/Colors';

const AUTO_DISMISS_MS = 2000;

export default function ScanResultOverlay({ visible, result, onDismiss, dismissHint }) {
  useEffect(() => {
    if (!visible || !result) return undefined;

    const timer = setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [visible, result, onDismiss]);

  if (!result) return null;

  const isSuccess = result.status === 'success' || result.status === 'warning';
  const iconName = isSuccess ? 'checkmark-circle' : 'close-circle';
  const iconColor = isSuccess ? Colors.good : Colors.error;

  return (
    <Modal
      visible={!!visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} accessibilityLabel="Dismiss" />
        <View style={styles.card} pointerEvents="box-none">
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: isSuccess ? `${Colors.good}26` : `${Colors.error}26` },
            ]}
          >
            <Ionicons name={iconName} size={40} color={iconColor} />
          </View>

          <Text style={[styles.title, { color: iconColor }]}>{result.title}</Text>

          {result.visitorName ? (
            <Text style={styles.visitorName}>{result.visitorName}</Text>
          ) : null}

          <Text style={styles.message}>{result.message}</Text>

          <Text style={styles.hint}>
            {dismissHint ?? 'Returning to event details in 2 seconds…'}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Overlays.backdrop,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Overlays.borderLight,
    backgroundColor: Colors.light,
    padding: 24,
    alignItems: 'center',
    zIndex: 1,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  visitorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.beta,
    textAlign: 'center',
    marginTop: 8,
  },
  message: {
    fontSize: 14,
    color: Overlays.textMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  hint: {
    fontSize: 11,
    color: Overlays.textDim,
    textAlign: 'center',
    marginTop: 16,
  },
});
