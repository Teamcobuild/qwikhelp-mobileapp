import { Redirect } from "expo-router";

// redirects to the home screen when accessing /tabs directly
export default function TabsIndex() {
    return <Redirect href="/(customer-tabs)/home" />;
}
