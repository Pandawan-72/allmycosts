import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const lightTheme = {
  bg: "#F9FAFB",
  surface: "#FFFFFF",
  surfaceAlt: "#F3F4F6",
  primary: "#111827",
  primaryInverse: "#FFFFFF",
  cardBg: "#1F2937",
  text: "#111827",
  textMuted: "#6B7280",
  textSubtle: "#9CA3AF",
  accent: "#10B981",
  accentSoft: "#D1FAE5",
  border: "#E5E7EB",
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  dark: false,
};

export const darkTheme = {
  bg: "#1A1D23",
  surface: "#23272F",
  surfaceAlt: "#2C3039",
  primary: "#F9FAFB",
  primaryInverse: "#111827",
  cardBg: "#2D3748",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  textSubtle: "#6B7280",
  accent: "#10B981",
  accentSoft: "#064E3B",
  border: "#374151",
  danger: "#EF4444",
  warning: "#F59E0B",
  success: "#10B981",
  dark: true,
};

type Theme = typeof lightTheme;
type ThemeContextType = { theme: Theme; isDark: boolean; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
});

export let currentTheme = lightTheme;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("darkMode").then((val) => {
      if (val === "true") setIsDark(true);
    });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem("darkMode", String(next));
      currentTheme = next ? darkTheme : lightTheme;
      return next;
    });
  };

  currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
