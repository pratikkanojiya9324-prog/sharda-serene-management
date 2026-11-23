import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { ResidentFlatProvider } from '@/lib/residentFlat';
import type { IconName } from '@/theme/components';
import { useTheme } from '@/theme/tokens';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'notices', title: 'Notices', icon: 'megaphone-outline', iconActive: 'megaphone' },
  { name: 'complaints', title: 'Complaints', icon: 'construct-outline', iconActive: 'construct' },
  { name: 'bills', title: 'Bills', icon: 'receipt-outline', iconActive: 'receipt' },
  { name: 'family', title: 'Family', icon: 'people-outline', iconActive: 'people' },
  { name: 'more', title: 'More', icon: 'ellipsis-horizontal-circle-outline', iconActive: 'ellipsis-horizontal-circle' },
];

/** Full-screen routes reached from Home / More / notifications: no tab button, no tab bar. */
const HIDDEN = ['request/[id]', 'passes', 'history', 'change-password', 'daily-help', 'expecting', 'parcels'];

// Notices, Complaints and Bills are stacks (list → detail) inside their tab.
// Notification taps are handled in the root layout (they must also work for a
// user whose home is the guard screen).
export default function ResidentLayout() {
  const { colors } = useTheme();
  return (
    <ResidentFlatProvider>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSubtle,
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          sceneStyle: { backgroundColor: colors.background },
        }}>
        {TABS.map((t) => (
          <Tabs.Screen
            key={t.name}
            name={t.name}
            options={{
              title: t.title,
              tabBarIcon: ({ color, focused, size }) => (
                <Ionicons name={focused ? t.iconActive : t.icon} size={size} color={color as string} />
              ),
            }}
          />
        ))}
        {/* Not `href: null`: in this expo-router that makes the route unreachable. */}
        {HIDDEN.map((name) => (
          <Tabs.Screen
            key={name}
            name={name}
            options={{ tabBarItemStyle: { display: 'none' }, tabBarStyle: { display: 'none' } }}
          />
        ))}
      </Tabs>
    </ResidentFlatProvider>
  );
}
