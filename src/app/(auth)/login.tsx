import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ImageBackground,
    Alert,
} from 'react-native';
import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/src/lib/supabase';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Hata", "Lütfen e-posta ve şifre alanlarını doldurun.");
            return;
        }

        // Supabase'den giriş kontrolü yapıyoruz
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert("Giriş Başarısız", "E-posta veya şifre hatalı.");
        } else {
            // Başarılıysa ana sayfaya fırlat
            router.replace('/(main)/(tabs)');
        }
    };

    return (
        <ImageBackground
            // Arka plan için temsili karanlık bir sinema/film görseli
            source={{ uri: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=3540&auto=format&fit=crop' }}
            style={styles.backgroundImage}
            resizeMode="cover"
            imageStyle={styles.backgroundImageInner}
        >
            {/* Karanlık gradyan katmanı - Yukarıdan aşağıya karararak yazıların okunmasını sağlar */}
            <LinearGradient
                colors={['rgba(17, 24, 39, 0.15)', 'rgba(29, 43, 69, 0.58)', 'rgba(17, 24, 39, 0.88)']}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.container}
                    >
                        <View style={styles.formContainer}>
                            {/* Başlık Alanı */}
                            <Text style={[styles.title, { color: theme.text }]}>{lang.auth.loginTitle}</Text>
                            <Text style={[styles.subtitle, { color: theme.mutedText }]}>{lang.auth.loginSubtitle}</Text>

                            {/* Form Alanı (Şeffaf cam efekti - Glassmorphism) */}
                            <TextInput
                                style={[styles.input, { backgroundColor: 'rgba(31, 41, 55, 0.6)', borderColor: theme.inputBorder, color: theme.text }]}
                                placeholder={lang.auth.emailPlaceholder}
                                placeholderTextColor={theme.mutedText}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <TextInput
                                style={[styles.input, { backgroundColor: 'rgba(31, 41, 55, 0.6)', borderColor: theme.inputBorder, color: theme.text }]}
                                placeholder={lang.auth.passwordPlaceholder}
                                placeholderTextColor={theme.mutedText}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />

                            {/* Giriş Butonu */}
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: theme.primary }]}
                                onPress={handleLogin}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.buttonText}>{lang.auth.loginButton}</Text>
                            </TouchableOpacity>

                            {/* Kayıt Ol Linki */}
                            <View style={styles.footer}>
                                <Text style={{ color: theme.mutedText }}>{lang.auth.noAccountText}</Text>
                                <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
                                    <Text style={[styles.link, { color: theme.primary }]}>{lang.auth.signUpLink}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </LinearGradient>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    backgroundImage: { flex: 1, width: '100%', height: '100%' },
    backgroundImageInner: {
        width: '100%',
        height: '100%',
        opacity: 0.95,
    },
    gradient: { flex: 1 },
    safeArea: { flex: 1 },
    container: {
        flex: 1,
        justifyContent: 'flex-end', // İçeriği zarifçe ekranın altına doğru yaslar
        paddingBottom: 50
    },
    formContainer: { paddingHorizontal: 24, width: '100%' },
    title: {
        fontSize: 36,
        fontWeight: '900',
        marginBottom: 8,
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.75)', // Başlığa sinematik bir gölge
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10
    },
    subtitle: { fontSize: 16, marginBottom: 32, textAlign: 'center', lineHeight: 22 },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
        fontSize: 16
    },
    button: {
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        shadowColor: "#ef4444", // Butona parlayan kırmızı bir aura efekti
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8
    },
    buttonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
    link: { fontWeight: 'bold', fontSize: 16 }
});