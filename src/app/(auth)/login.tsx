import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen e-posta ve şifre alanlarını doldurun.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      Alert.alert('Giriş Başarısız', 'E-posta veya şifre hatalı.');
    }
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop' }}
      style={styles.background}
      imageStyle={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[theme.background, theme.overlay, theme.background]}
        locations={[0, 0.42, 1]}
        style={styles.overlay}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardArea}>
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.authContent}>
                <View style={styles.brand}>
                  <View style={[styles.brandIcon, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                    <Ionicons name="film-outline" size={26} color={theme.primary} />
                  </View>
                  <Text style={[styles.brandName, { color: theme.text }]}>{lang.auth.brandName}</Text>
                </View>

                <Text style={[styles.title, { color: theme.text }]}>{lang.auth.loginTitle}</Text>
                <Text style={[styles.subtitle, { color: theme.mutedText }]}>{lang.auth.loginSubtitle}</Text>

                <View style={[styles.authCard, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, borderColor: theme.inputBorder, color: theme.text }]}
                    placeholder={lang.auth.emailPlaceholder}
                    placeholderTextColor={theme.mutedText}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.background, borderColor: theme.inputBorder, color: theme.text }]}
                    placeholder={lang.auth.passwordPlaceholder}
                    placeholderTextColor={theme.mutedText}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="current-password"
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => { void handleLogin(); }}
                    style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: pressed ? 0.88 : 1 }]}
                  >
                    <Text style={[styles.buttonText, { color: theme.text }]}>{lang.auth.loginButton}</Text>
                  </Pressable>
                </View>

                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: theme.mutedText }]}>{lang.auth.noAccountText}</Text>
                  <Pressable accessibilityRole="link" onPress={() => router.push('/(auth)/register')} style={styles.signUpLink}>
                    <Text style={[styles.signUpText, { color: theme.primary }]}>{lang.auth.signUpLink}</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  backgroundImage: { opacity: 0.8 },
  overlay: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 36, paddingBottom: 84 },
  authContent: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  brand: { alignItems: 'center', gap: 10, marginBottom: 30 },
  brandIcon: { width: 54, height: 54, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 27, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 26, paddingHorizontal: 8 },
  authCard: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 12 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { fontSize: 16, fontWeight: '800' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  footerText: { fontSize: 14 },
  signUpLink: { minHeight: 44, justifyContent: 'center' },
  signUpText: { fontSize: 14, fontWeight: '700' },
});
