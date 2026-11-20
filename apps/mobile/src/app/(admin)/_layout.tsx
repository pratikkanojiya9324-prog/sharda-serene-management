import { Stack } from 'expo-router';

// Placeholder layout so the root Stack can register "(admin)"; becomes the admin tabs next.
export default function AdminLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
