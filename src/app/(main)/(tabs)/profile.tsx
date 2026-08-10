import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { currentTheme as theme } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/src/lib/supabase';

export default function ProfileScreen() {
const handleLogout = async () => {
  const { error } = await supabase.auth.signOut();

  if (!error) {
    // Çıkış başarılıysa login'e gönder
    router.replace('/(auth)/login');
  }
};

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.avatarContainer}>
        <Ionicons name="person-circle-outline" size={120} color={theme.mutedText} />
        <Text style={[styles.name, { color: theme.text }]}>Sinema Delisi</Text>
      </View>

      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: '#1f2937', borderColor: theme.primary }]} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={theme.primary} />
        <Text style={[styles.logoutText, { color: theme.primary }]}>Çıkış Yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 20, paddingTop: 50 },
  avatarContainer: { alignItems: 'center', marginBottom: 40 },
  name: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  logoutButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 24, borderRadius: 12, borderWidth: 1, marginTop: 'auto', marginBottom: 20
  },
  logoutText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 }
});