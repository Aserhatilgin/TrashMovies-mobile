import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, Alert } from 'react-native';
import { router } from 'expo-router';
import { currentTheme as theme } from '../../constants/Colors';
import { supabase } from '@/src/lib/supabase';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

 const handleRegister = async () => {
  if (!email || !password) {
    Alert.alert("Hata", "Lütfen e-posta ve şifre alanlarını doldurun.");
    return;
  }

  // Supabase'e kayıt isteği atıyoruz
  const { data, error } = await supabase.auth.signUp({
    email: email,
    password: password,
  });

  if (error) {
    Alert.alert("Kayıt Başarısız", error.message);
  } else {
    Alert.alert("Başarılı", "Kayıt oldun! Hoş geldin.");
    // Başarılıysa içeri al
    router.replace('/(main)/(drawer)/(tabs)');
  }
};

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={[styles.title, { color: theme.text }]}>Aramıza Katıl</Text>
          <Text style={[styles.subtitle, { color: theme.mutedText }]}>Çöplüğe girmek için bir bilet al.</Text>

          <TextInput
            style={[styles.input, { backgroundColor: 'rgba(31, 41, 55, 0.6)', borderColor: theme.inputBorder, color: theme.text }]}
            placeholder="Kullanıcı Adı"
            placeholderTextColor={theme.mutedText}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, { backgroundColor: 'rgba(31, 41, 55, 0.6)', borderColor: theme.inputBorder, color: theme.text }]}
            placeholder="E-posta"
            placeholderTextColor={theme.mutedText}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[styles.input, { backgroundColor: 'rgba(31, 41, 55, 0.6)', borderColor: theme.inputBorder, color: theme.text }]}
            placeholder="Şifre"
            placeholderTextColor={theme.mutedText}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={[styles.button, { backgroundColor: theme.primary }]} onPress={handleRegister}>
            <Text style={styles.buttonText}>Kayıt Ol</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={{ color: theme.mutedText }}>Zaten hesabın var mı? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={[styles.link, { color: theme.primary }]}>Giriş Yap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, justifyContent: 'center' },
  formContainer: { paddingHorizontal: 24, width: '100%' },
  title: { fontSize: 36, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 18, marginBottom: 16, fontSize: 16 },
  button: { padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  link: { fontWeight: 'bold', fontSize: 16 }
});