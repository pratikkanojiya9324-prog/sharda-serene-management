import { signOut } from '@/lib/signOut';
import { Button, Card, EmptyState, Header, Screen } from '@/theme/components';

// Placeholder: the in-app admin screens (Notices, Complaints, Bills) arrive next.
export default function AdminHome() {
  return (
    <Screen scroll>
      <Header overline="Admin" title="Society admin" subtitle="Manage notices, complaints and bills" />
      <Card>
        <EmptyState
          icon="construct-outline"
          title="Admin tools are on the way"
          message="Notices, complaints and bills will appear here soon."
        />
      </Card>
      <Button title="Sign out" icon="log-out-outline" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}
