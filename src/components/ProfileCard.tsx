import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { currentTheme as theme } from '../constants/Colors';

interface ProfileCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ProfileCard({ children, style }: ProfileCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'stretch', width: '100%', borderWidth: 1, borderRadius: 16, padding: 16 },
});
