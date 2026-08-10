import { Drawer } from 'expo-router/drawer';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { currentTheme as theme } from '../../constants/Colors';

export default function MainLayout() {
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
        headerLeft: () => <DrawerToggleButton tintColor={theme.text} />,
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