import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                // 1. Fix the height and padding
                tabBarStyle: {
                    backgroundColor: "white",
                    borderTopWidth: 0, // Remove the ugly top line
                    elevation: 0,      // Remove Android shadow for a cleaner look
                    height: Platform.OS === 'ios' ? 85 : 60, // Taller on iOS for the home indicator
                    paddingBottom: Platform.OS === 'ios' ? 30 : 10, // Push content up on iOS
                    paddingTop: 10,
                },
                // 2. Fix the Colors
                tabBarActiveTintColor: "#2563EB", // Blue-600 (Your brand color)
                tabBarInactiveTintColor: "#9CA3AF", // Gray-400

                // 3. Fix the Text
                tabBarLabelStyle: {
                    fontFamily: "Satoshi-Bold", // Use your custom font!
                    fontSize: 10,
                    marginTop: -5, // Pull text closer to icon
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                    ),
                }}
            />

            {/* Swap History and Nearby if needed to match design order */}
            <Tabs.Screen
                name="nearby"
                options={{
                    title: "Nearby",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "location" : "location-outline"} size={24} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="history"
                options={{
                    title: "Booking History",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
                    ),
                }}
            />

            <Tabs.Screen
                name="account"
                options={{
                    title: "Account",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
                    ),
                }}
            />

            {/* Hide the index redirect from tabs */}
            <Tabs.Screen
                name="index"
                options={{
                    href: null, // This prevents it from showing in the tab bar
                }}
            />
        </Tabs>
    );
}