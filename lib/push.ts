import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';

// The chat screen the user is looking at; its own message pushes are not shown as banners.
let activeConversationId: string | null = null;
export const setActiveConversation = (id: string | null) => {
  activeConversationId = id;
};

// Show notifications as banners while the app is open too.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { conversationId?: string };
    const show = !(data?.conversationId && data.conversationId === activeConversationId);
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: true };
  },
});

const projectId: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any).easConfig?.projectId;

// Asks for permission (once), gets this device's Expo push token and links it to the signed-in user.
// Returns null when push isn't possible here (simulator, permission denied, no EAS project yet).
export async function registerForPush(supabase: SupabaseClient): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (!projectId) {
    console.warn('Push notifications disabled: no EAS projectId. Run `eas init` to create one.');
    return null;
  }

  if (Platform.OS === 'android') {
    // Must match the channelId the database sends (private.send_push).
    await Notifications.setNotificationChannelAsync('default', {
      name: 'QwikHelp',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', { p_token: token });
  if (error) throw error;
  return token;
}

// Call before signing out so this device stops receiving the user's notifications.
export async function clearPushToken(supabase: SupabaseClient) {
  const { error } = await supabase.rpc('clear_push_token');
  if (error) console.warn('Could not clear push token:', error.message);
}
