import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { TEST_IDS } from '@/constants/testIds';
import { Neo } from '@/constants/theme';

export default function CustomerTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Neo.foreground,
        tabBarInactiveTintColor: Neo.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
        },
        tabBarStyle: {
          minHeight: 68,
          borderTopColor: Neo.border,
          borderTopWidth: Neo.borderWidth,
          backgroundColor: Neo.surface,
        },
      }}>
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Каталог',
          tabBarButtonTestID: TEST_IDS.tabs.catalog,
          tabBarIcon: ({ color }) => <TabIcon color={color} label="⌂" />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Заказы',
          tabBarButtonTestID: TEST_IDS.tabs.orders,
          tabBarIcon: ({ color }) => <TabIcon color={color} label="▤" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarButtonTestID: TEST_IDS.tabs.profile,
          tabBarIcon: ({ color }) => <TabIcon color={color} label="◎" />,
        }}
      />
    </Tabs>
  );
}

function TabIcon({ color, label }: { color: string; label: string }) {
  return <Text style={{ color, fontSize: 20, fontWeight: '800' }}>{label}</Text>;
}
