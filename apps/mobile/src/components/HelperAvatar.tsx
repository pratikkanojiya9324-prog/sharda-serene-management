import type { HelperType } from '@society-gate/shared';
import { Image, View } from 'react-native';

import { IconBadge } from '@/components/resident';
import { helperTypeIcon } from '@/lib/helpers';
import { useSignedUrl } from '@/lib/useSignedUrl';

/** Round photo of a daily-help person, or a type icon when there is no photo. */
export function HelperAvatar({ photoPath, type, size = 48 }: { photoPath: string | null; type: HelperType; size?: number }) {
  const url = useSignedUrl('helper-photos', photoPath);
  if (photoPath && url) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Image source={{ uri: url }} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
    );
  }
  return <IconBadge icon={helperTypeIcon(type)} size={size} />;
}
