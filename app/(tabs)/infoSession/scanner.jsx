import { View, StyleSheet } from 'react-native';
import { useAppContext } from '@/context';
import { userCanAccessScan } from '@/components/helpers/helpers';
import AccessDenied from '../events/Partials/AccessDenied';
import InfoSessionScanner from './Partials/InfoSessionScanner';

export default function InfoSessionScannerScreen() {
  const { user } = useAppContext();

  if (!userCanAccessScan(user)) {
    return <AccessDenied />;
  }

  return (
    <View style={styles.screen}>
      <InfoSessionScanner />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
});
