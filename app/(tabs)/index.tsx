import "@/app/global.css";
import { Button } from "@/components/ui/Button";
import { View } from "react-native";
export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Button title="Book Provider" variant="danger" />
    </View>
  );
}