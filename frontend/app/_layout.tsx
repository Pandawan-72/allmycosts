import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import "@/src/i18n";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { SubscriptionsProvider } from "@/src/contexts/SubscriptionsContext";
import { LanguageProvider } from "@/src/contexts/LanguageContext";
import { ThemeProvider, useTheme } from "@/src/contexts/ThemeContext";

SplashScreen.preventAutoHideAsync();

// Pilote la couleur des icônes système (heure, batterie, wifi...) selon le
// thème ACTIF DANS L'APP (isDark du ThemeContext), pas selon le thème du
// système d'exploitation — sinon les icônes restent invisibles quand
// l'utilisateur active le mode sombre manuellement dans l'app alors que
// son téléphone est en thème clair.
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <SubscriptionsProvider>
              <ThemedStatusBar />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F9FAFB" } }} />
            </SubscriptionsProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
