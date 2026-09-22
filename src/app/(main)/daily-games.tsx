import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { currentTheme as theme } from '../../constants/Colors';
import { currentLang as lang } from '../../constants/Translations';

export default function DailyGamesScreen() {
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Ionicons name="game-controller-outline" size={56} color={theme.primary} />
      <Text style={[styles.title, { color: theme.text }]}>{lang.game.dailyTitle}</Text>
      <Text style={[styles.message, { color: theme.mutedText }]}>{lang.game.dailyPlaceholder}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 15, textAlign: 'center' },
});
