import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, EmptyState, Screen } from '@/theme/components';
import { space } from '@/theme/tokens';

/** Last-resort screen when a render error reaches the root error boundary. */
export function CrashScreen({ onRetry }: { onRetry: () => void }) {
  const router = useRouter();
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon="alert-circle-outline"
          tone="danger"
          title="Something went wrong"
          message="Please try again. If it keeps happening, tell the society office."
          action={
            <View style={{ gap: space.sm }}>
              <Button title="Try again" icon="refresh" onPress={onRetry} />
              <Button title="Go to home" icon="home-outline" variant="ghost" onPress={() => router.replace('/')} />
            </View>
          }
        />
      </View>
    </Screen>
  );
}
