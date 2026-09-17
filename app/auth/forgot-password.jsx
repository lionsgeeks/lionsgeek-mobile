import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';
import { router } from 'expo-router';
import { Home as LogoIcon } from '@/components/logo';
import { Button, Input } from '@/components/ui';

export default function ForgotPassword() {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const send = async () => {
    if (__DEV__) console.log('[FORGOT] Sending reset link');
    if (!email) return setError('Please enter your email');
    setSending(true);
    setMessage('');
    setError('');
    try {
      const response = await API.post('mobile/forgot-password', { email });
      setMessage(response?.data?.status || 'Check your email for a reset link');
    } catch (e) {
      if (__DEV__) console.error('[FORGOT] Failed', e?.message);
      setError('Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const isDark = colorScheme === 'dark';

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      className={`flex-1 ${isDark ? 'bg-black' : 'bg-white'}`}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 px-6 pt-16 pb-8 justify-between">
          {/* Top Section - Logo */}
          <View className="items-center mt-8">
            <LogoIcon color={isDark ? '#fff' : '#000'} width={80} height={80} />
            <Text className="text-2xl font-bold text-black dark:text-white mt-4">LIONSGEEK</Text>
          </View>

          {/* Middle Section - Form */}
          <View className="flex-1 justify-center max-w-md w-full mx-auto" style={{ minHeight: 300 }}>
            <View className="items-center mb-8">
              <Text className="text-2xl font-semibold text-black dark:text-white text-center">
                Forgot password
              </Text>
              <Text className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-center">
                Enter your email to receive a reset link
              </Text>
            </View>
            
            {!!message && (
              <Text className="text-green-600 dark:text-green-400 mb-4 text-center text-sm font-medium">
                {message}
              </Text>
            )}
            
            {!!error && (
              <Text className="text-red-500 mb-4 text-center text-sm font-medium">
                {error}
              </Text>
            )}
            
            <Input
              label="Email address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@example.com"
              error={!!error}
            />
            
            <Button
              onPress={send}
              disabled={sending}
              loading={sending}
              variant="default"
              size="lg"
              className="mt-2"
            >
              Send reset link
            </Button>
          </View>

          {/* Bottom Section - Back Link */}
          <View className="items-center pb-4">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-gray-600 dark:text-gray-400 text-base">
                Back to login
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}



