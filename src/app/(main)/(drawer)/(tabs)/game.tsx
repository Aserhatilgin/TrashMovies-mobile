import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { currentTheme as theme } from '../../../../constants/Colors';
import { currentLang as lang } from '../../../../constants/Translations';

const HORIZONTAL_PADDING = 20;
const CARD_GAP = 12;

export default function GameScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;
  const games = [
    { title: lang.game.guessMovie, icon: 'film-outline' },
    { title: lang.game.posterQuiz, icon: 'image-outline' },
    { title: lang.game.trueFalse, icon: 'checkmark-done-outline' },
    { title: lang.game.findActor, icon: 'people-outline' },
  ] as const;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={[styles.scoreCard, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
        <View>
          <Text style={[styles.scoreLabel, { color: theme.text }]}>{lang.game.score}</Text>
          <Text style={[styles.previewLabel, { color: theme.mutedText }]}>{lang.game.previewLabel}</Text>
        </View>
        <Text style={[styles.scoreValue, { color: theme.primary }]}>{lang.game.previewScore}</Text>
      </View>

      <Pressable
        accessibilityLabel={lang.game.openDailyGames}
        accessibilityRole="button"
        onPress={() => router.push('/(main)/daily-games')}
        style={({ pressed }) => [
          styles.featuredCard,
          { backgroundColor: theme.inputBg, borderColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[styles.featuredIcon, { backgroundColor: theme.background }]}>
          <Ionicons name="game-controller-outline" size={52} color={theme.primary} />
        </View>
        <View style={styles.featuredFooter}>
          <View style={styles.featuredText}>
            <Text style={[styles.featuredTitle, { color: theme.text }]}>{lang.game.dailyTitle}</Text>
            <Text style={[styles.featuredSubtitle, { color: theme.mutedText }]}>{lang.game.dailySubtitle}</Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={theme.primary} />
        </View>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: theme.text }]}>{lang.game.allGames}</Text>
      <View style={styles.grid}>
        {games.map((game) => (
          <View
            key={game.title}
            style={[styles.gameCard, { width: cardWidth, backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
          >
            <View style={[styles.gameIcon, { backgroundColor: theme.background }]}>
              <Ionicons name={game.icon} size={36} color={theme.primary} />
            </View>
            <Text style={[styles.gameTitle, { color: theme.text }]}>{game.title}</Text>
            <Text style={[styles.comingSoon, { color: theme.mutedText }]}>{lang.game.comingSoon}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 20, paddingBottom: 32, gap: 18 },
  scoreCard: { borderWidth: 1, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { fontSize: 16, fontWeight: '700' },
  previewLabel: { fontSize: 12, marginTop: 4 },
  scoreValue: { fontSize: 30, fontWeight: '800' },
  featuredCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 18 },
  featuredIcon: { height: 110, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featuredFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featuredText: { flex: 1, gap: 4 },
  featuredTitle: { fontSize: 21, fontWeight: '800' },
  featuredSubtitle: { fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  gameCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  gameIcon: { height: 92, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gameTitle: { fontSize: 15, fontWeight: '700' },
  comingSoon: { fontSize: 12 },
});
