import { useEffect } from "react";
import { Stack } from "expo-router";
import { configureRC } from "@/src/lib/revenuecat";

export default function AppLayout() {
  useEffect(() => {
    configureRC();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
