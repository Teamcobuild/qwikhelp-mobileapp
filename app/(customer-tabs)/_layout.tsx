import { ProfileTabIcon } from "@/components/ui/ProfileTabIcon";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
    // Edge-to-edge Android draws under the system nav bar, so lift the tabs above it (and the iOS home indicator).
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 10);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "white",
                    borderTopWidth: 0,
                    elevation: 0,
                    height: 50 + bottomPadding,
                    paddingBottom: bottomPadding,
                    paddingTop: 10,
                },
                tabBarActiveTintColor: "#2563EB",
                tabBarInactiveTintColor: "#9CA3AF",
                tabBarLabelStyle: {
                    fontFamily: "Satoshi-Bold",
                    fontSize: 10,
                    marginTop: -5,
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color as string} />
                    ),
                }}
            />


            <Tabs.Screen
                name="history"
                options={{
                    title: "Bookings",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color as string} />
                    ),
                }}
            />

            <Tabs.Screen
                name="messages"
                options={{
                    title: "Messages",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={24} color={color as string} />
                    ),
                }}
            />

            <Tabs.Screen
                name="account"
                options={{
                    title: "Account",
                    tabBarIcon: ({ color, focused }) => (
                        <ProfileTabIcon color={color as string} focused={focused} />
                    ),
                }}
            />
        </Tabs>
    );
}