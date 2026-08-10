import { View, Text, StyleSheet } from 'react-native';
import { currentTheme as theme } from '../../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export default function GameScreen() {
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Ionicons name="game-controller" size={80} color={theme.primary} style={{ marginBottom: 20 }} />
      <Text style={[styles.title, { color: theme.text }]}>Oyun Odası</Text>
      <Text style={[styles.subtitle, { color: theme.mutedText }]}>Filmi tahmin et, puanları topla!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center' }
});