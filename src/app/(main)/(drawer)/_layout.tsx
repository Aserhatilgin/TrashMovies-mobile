import { Drawer } from 'expo-router/drawer';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { router, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSelector } from 'react-redux';
import { Pressable, StyleSheet, View } from 'react-native';
import { HomeStreakIndicator } from '../../../components/HomeStreakIndicator';
import { currentTheme as theme } from '../../../constants/Colors';
import { currentLang as lang } from '../../../constants/Translations';
import type { RootState } from '../../../store';

export default function MainLayout() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const segments = useSegments();
  const isHome = segments[0] === '(main)' && segments[1] === '(drawer)' && segments[2] === '(tabs)' && segments[3] === undefined;

  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTintColor: theme.text,
        headerTitleAlign: 'center',
        headerLeft: () => (
          <View style={styles.headerSide}>
            <DrawerToggleButton tintColor={theme.text} />
          </View>
        ),
        headerRight: () => (
          <View style={[styles.headerSide, styles.headerActions]}>
            {isHome && isAuthenticated && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={lang.profile.openSavedMovies}
                  onPress={() => router.push('/(main)/saved-movies')}
                  style={styles.headerButton}
                >
                  <Ionicons name="bookmark-outline" size={22} color={theme.text} />
                </Pressable>
                <HomeStreakIndicator />
              </>
            )}
          </View>
        ),
        drawerStyle: {
          backgroundColor: theme.background,
        },
        drawerActiveTintColor: theme.primary,
        drawerInactiveTintColor: theme.text,
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          title: 'Çöplük',
          headerTitle: 'Çöplük',
        }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  headerSide: { width: 112, flexDirection: 'row', alignItems: 'center' },
  headerActions: { justifyContent: 'flex-end', paddingRight: 8, gap: 2 },
  headerButton: { width: 42, height: 44, alignItems: 'center', justifyContent: 'center' },
});
