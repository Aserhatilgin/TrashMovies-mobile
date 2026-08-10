import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { currentTheme as theme } from '../../../constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: theme.primary,
        tabBarStyle: { backgroundColor: theme.background, borderTopWidth: 0 },
        headerStyle: { backgroundColor: theme.background, shadowOpacity: 0, elevation: 0 },
        headerTintColor: theme.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color }) => <Ionicons name="film-outline" size={24} color={color} />
        }}
      />

      <Tabs.Screen
        name="game"
        options={{
          title: 'Oyun',
          tabBarIcon: ({ color }) => <Ionicons name="game-controller-outline" size={24} color={color} />
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />
        }}
      />
    </Tabs>
  );
}