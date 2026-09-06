import { Tabs } from 'expo-router';
import { Image } from 'expo-image';
import { theme } from '../src/theme';

const icon = (name: string, color: string) => (
  <Image source={`sf:${name}`} style={{ width: 19, height: 19, tintColor: color }} />
);

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.canvas },
        headerTitleStyle: { color: theme.text, fontWeight: '650' },
        tabBarStyle: { borderTopColor: theme.border, backgroundColor: theme.canvas },
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.text3,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Chat', tabBarIcon: ({ color }) => icon('bubble.left.and.bubble.right', color) }} />
      <Tabs.Screen name="work" options={{ title: 'Work', tabBarIcon: ({ color }) => icon('briefcase', color) }} />
      <Tabs.Screen name="space" options={{ title: 'Space', tabBarIcon: ({ color }) => icon('rectangle.split.3x1', color) }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
    </Tabs>
  );
}
