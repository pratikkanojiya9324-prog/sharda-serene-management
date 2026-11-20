import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { AdminSocietyProvider } from '@/lib/adminSociety';
import type { IconName } from '@/theme/components';
import { useTheme } from '@/theme/tokens';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Notices', icon: 'megaphone-outline', iconActive: 'megaphone' },
  { name: 'complaints', title: 'Complaints', icon: 'construct-outline', iconActive: 'construct' },
  { name: 'bills/index', title: 'Bills', icon: 'receipt-outline', iconActive: 'receipt' },
  { name: 'more', title: 'More', icon: 'ellipsis-horizontal-circle-outline', iconActive: 'ellipsis-horizontal-circle' },
];

/** Full-screen routes without a tab button or tab bar. */
const HIDDEN = ['notices/new'];

// In-app admin: Notices (post / pin / delete), Complaints (a list → detail
// stack), Bills (by month, mark paid) and More.
export default function AdminLayout() {
  const { colors } = useTheme();
  return (
    <AdminSocietyProvider>
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
    </AdminSocietyProvider>
  );
}
