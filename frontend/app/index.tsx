import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { useTheme } from "@/src/contexts/ThemeContext";

export default function Index() {
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center} testID="boot-loader">
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  return user ? <Redirect href="/(app)/home" /> : <Redirect href="/(auth)/sign-in" />;
}

function makeStyles(theme: any) { return StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.bg },
});
}
