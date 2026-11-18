import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { currentTheme as theme } from '../constants/Colors';
import { currentLang as lang } from '../constants/Translations';

interface MovieRatingModalProps {
  visible: boolean; selectedRating: number | null; saving: boolean;
  onSelect: (rating: number) => void; onClose: () => void; onSave: () => void;
}
export function MovieRatingModal({ visible, selectedRating, saving, onSelect, onClose, onSave }: MovieRatingModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: theme.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>{lang.interactions.yourRating}</Text>
          <View style={styles.ratingChoices}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.ratingRow}>
                {Array.from({ length: 5 }, (_, column) => row * 5 + column + 1).map((rating) => (
                  <Pressable
                    key={rating}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selectedRating === rating }}
                    onPress={() => onSelect(rating)}
                    style={[styles.ratingChoice, {
                      backgroundColor: selectedRating === rating ? theme.primary : theme.background,
                      borderColor: selectedRating === rating ? theme.primary : theme.inputBorder,
                    }]}
                  >
                    <Text style={[styles.ratingNumber, { color: theme.text }]}>{rating}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={[styles.modalAction, { borderColor: theme.inputBorder }]}>
              <Text style={{ color: theme.mutedText }}>{lang.interactions.cancel}</Text>
            </Pressable>
            <Pressable
              disabled={selectedRating === null || saving}
              onPress={onSave}
              style={[styles.modalAction, styles.saveAction, { backgroundColor: theme.primary, opacity: selectedRating === null ? 0.5 : 1 }]}
            >
              <Text style={[styles.saveActionText, { color: theme.text }]}>{lang.interactions.saveRating}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalContent: { width: '100%', maxWidth: 340, borderWidth: 1, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 22 },
  ratingChoices: { gap: 9 },
  ratingRow: { flexDirection: 'row', gap: 9 },
  ratingChoice: { flex: 1, height: 46, borderWidth: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  ratingNumber: { fontSize: 16, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalAction: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 10 },
  saveAction: { borderWidth: 0 },
  saveActionText: { fontWeight: '700' },
});
