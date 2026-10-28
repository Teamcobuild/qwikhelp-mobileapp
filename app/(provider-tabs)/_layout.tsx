import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, Text, View } from "react-native";

function WalletTabIcon({ color, focused }: { color: string; focused: boolean }) {
    return (
        <View
            style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: focused ? 2.2 : 1.8,
                borderColor: color,
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Text
                style={{
                    color,
                    fontSize: 12,
                    fontFamily: "Satoshi-Bold",
                    marginTop: Platform.OS === "android" ? -2 : -1,
                }}
            >
                $
            </Text>
        </View>
    );
}

export default function ProviderTabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: "#FFFFFF",
                    borderTopWidth: 1,
                    borderTopColor: "#F3F4F6",
                    elevation: 4,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    height: Platform.OS === "ios" ? 88 : 68,
                    paddingBottom: Platform.OS === "ios" ? 28 : 10,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: "#2563EB",
                tabBarInactiveTintColor: "#6B7280",
                tabBarLabelStyle: {
                    fontFamily: "Satoshi-Bold",
                    fontSize: 11,
                    marginTop: 2,
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: "Home",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "home" : "home-outline"} size={24} color={(color as string) ?? "#2563EB"} />
                    ),
                }}
            />
            <Tabs.Screen
                name="jobs"
                options={{
                    title: "Jobs",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "clipboard" : "clipboard-outline"} size={23} color={(color as string) ?? "#6B7280"} />
                    ),
                }}
            />
            <Tabs.Screen
                name="earnings"
                options={{
                    title: "Wallet",
                    tabBarIcon: ({ color, focused }) => (
                        <WalletTabIcon color={(color as string) ?? "#6B7280"} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="account"
                options={{
                    title: "Profile",
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? "person" : "person-outline"} size={24} color={(color as string) ?? "#6B7280"} />
                    ),
                }}
            />
        </Tabs>
    );
}
