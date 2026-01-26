import { Redirect } from "expo-router";

// This redirects to the home screen when accessing /tabs directly
export default function TabsIndex() {
    return <Redirect href="/(tabs)/home" />;
}
