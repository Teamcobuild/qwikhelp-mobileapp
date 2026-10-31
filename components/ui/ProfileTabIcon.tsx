import { useAvatar } from '@/context/AvatarContext';
import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';

// Bottom-tab icon that shows the user's uploaded photo, or the person icon until they add one.
export function ProfileTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { avatarUrl } = useAvatar();
  if (!avatarUrl) {
    return <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />;
  }
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        padding: 1.5,
        borderWidth: focused ? 2 : 0,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%', borderRadius: 13 }} />
    </View>
  );
}
