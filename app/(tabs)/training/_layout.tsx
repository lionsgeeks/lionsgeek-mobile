import { Stack } from 'expo-router';

export default function TrainingStack() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      {/* List view */}
      <Stack.Screen name="index" />
      {/* Detail view */}
      <Stack.Screen 
        name="[id]" 
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animation: 'slide_from_right',
        }}
      />
      {/* Attendance view */}
      <Stack.Screen 
        name="attendance" 
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animation: 'slide_from_right',
        }}
      />
      {/* QR Scanner view */}
      <Stack.Screen 
        name="qr-scanner" 
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
