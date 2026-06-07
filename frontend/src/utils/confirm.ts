import { Alert, Platform } from "react-native";

type Btn = { text: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };

export function confirmAction(title: string, message: string, buttons: Btn[]) {
  if (Platform.OS === "web") {
    // Alert.alert callbacks don't fire on web. Use window.confirm for destructive prompts.
    const destructive = buttons.find((b) => b.style === "destructive") || buttons.find((b) => b.style !== "cancel");
    const ok = typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`);
    if (ok && destructive?.onPress) destructive.onPress();
    return;
  }
  Alert.alert(title, message, buttons);
}
