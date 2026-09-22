import { Ionicons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';

import { ProfileCard } from '../../../../components/ProfileCard';
import { SavedMovieCard } from '../../../../components/SavedMovieCard';
import { StreakSummary } from '../../../../components/StreakSummary';
import { currentTheme as theme } from '../../../../constants/Colors';
import { currentLang as lang } from '../../../../constants/Translations';
import { useActivitySummary } from '../../../../hooks/useActivitySummary';
import { useSavedMovies } from '../../../../hooks/useSavedMovies';
import { supabase } from '../../../../lib/supabase';
import type { RootState } from '../../../../store';
import { clearAuth } from '../../../../store/authSlice';

function metadataText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user) as User | null;
  const activity = useActivitySummary();
  const saved = useSavedMovies();
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const displayName = metadataText(metadata?.display_name)
    ?? metadataText(metadata?.full_name)
    ?? metadataText(metadata?.name)
    ?? lang.profile.fallbackName;
  const avatarUrl = metadataText(metadata?.avatar_url);
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  const handleLogout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (!error) dispatch(clearAuth());
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <ProfileCard>
        <View style={styles.identity}>
          {avatarUrl?.startsWith('https://') ? (
            <Image source={{ uri: avatarUrl }} style={[styles.avatar, { backgroundColor: theme.background }]} />
          ) : (
            <View style={[styles.avatar, styles.initialsAvatar, { backgroundColor: theme.primary }]}>
              <Text style={[styles.initials, { color: theme.text }]}>{initials}</Text>
            </View>
          )}
          <Text numberOfLines={2} style={[styles.name, { color: theme.text }]}>{displayName}</Text>
        </View>
        <View style={[styles.stats, { borderTopColor: theme.inputBorder }]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {activity.summary?.totalActiveDays ?? lang.profile.pendingValue}
            </Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>{lang.profile.activeDays}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text }]}>{lang.profile.pendingValue}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedText }]}>{lang.profile.gameScore}</Text>
          </View>
        </View>
      </ProfileCard>

      <StreakSummary {...activity} />

      <ProfileCard>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{lang.profile.gameScore}</Text>
        <Text style={{ color: theme.mutedText }}>{lang.profile.noScore}</Text>
      </ProfileCard>

      <View style={styles.savedSection}>
        <View style={styles.savedHeading}>
          <Text style={[styles.sectionTitle, styles.savedTitle, { color: theme.text }]}>{lang.profile.savedMovies}</Text>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/(main)/saved-movies')}
            style={styles.viewAll}
          >
            <Text style={[styles.viewAllText, { color: theme.primary }]}>{lang.profile.viewAll}</Text>
            <Ionicons name="chevron-forward" size={17} color={theme.primary} />
          </Pressable>
        </View>
        {saved.isLoading && saved.movies.length === 0 ? (
          <ActivityIndicator accessibilityLabel={lang.profile.loadingSaved} color={theme.primary} />
        ) : saved.hasError && saved.movies.length === 0 ? (
          <Text style={{ color: theme.mutedText }}>{lang.profile.savedError}</Text>
        ) : saved.movies.length === 0 ? (
          <Text style={{ color: theme.mutedText }}>{lang.profile.savedEmpty}</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedList}>
            {saved.movies.map((movie) => <SavedMovieCard key={movie.id} movie={movie} width={96} />)}
          </ScrollView>
        )}
      </View>

      <TouchableOpacity
        style={[styles.logoutButton, { backgroundColor: theme.inputBg, borderColor: theme.primary }]}
        onPress={() => { void handleLogout(); }}
      >
        <Ionicons name="log-out-outline" size={20} color={theme.primary} />
        <Text style={[styles.logoutText, { color: theme.primary }]}>{lang.profile.logout}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 32, gap: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  initialsAvatar: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 22, fontWeight: '800' },
  name: { flex: 1, fontSize: 22, fontWeight: '700' },
  stats: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 3 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  savedTitle: { marginBottom: 0 },
  savedSection: { alignSelf: 'stretch', width: '100%', paddingTop: 4 },
  savedHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  viewAll: { flexDirection: 'row', alignItems: 'center', minHeight: 36 },
  viewAllText: { fontSize: 13, fontWeight: '700' },
  savedList: { gap: 12, paddingBottom: 4 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  logoutText: { fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
});
