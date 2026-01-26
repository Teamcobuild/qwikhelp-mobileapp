import { Button } from '@/components/ui/Button';
import { Typography } from '@/components/ui/Typography';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const [fontsLoaded, error] = useFonts({
    "Satoshi-Regular": require("../../assets/fonts/Satoshi-Regular.otf"),
    "Satoshi-Bold": require("../../assets/fonts/Satoshi-Bold.otf"),
  });

  useEffect(() => {
    if (error) throw error;

    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);
  if (!fontsLoaded) {
    return null;
  }
  return (
    <View className='px-4 gap-4'>
      <Typography variant='h1'>Sign Up</Typography>
      <Button title='Login' />
      <Button title='Sign Up' variant='outline' />
    </View>
  );
}