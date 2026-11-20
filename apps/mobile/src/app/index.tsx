import { ActivityIndicator, View } from 'react-native';

import { ui } from '@/lib/ui';

// Landing route while the post-login bootstrap decides where to send the user.
export default function Index() {
  return (
    <View style={ui.screen}>
      <ActivityIndicator />
    </View>
  );
}
