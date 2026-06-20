import { Image, ImageStyle, StyleProp, View, ViewStyle } from "react-native";
import { useTheme } from "@/src/contexts/ThemeContext";

type Props = {
  height?: number;
  style?: StyleProp<ViewStyle>;
};

// Wide brand lockup: coin emblem + "All My Costs" text baked in.
// Source image aspect ratio ~3.9:1 (1000x256). Switches to a dark-mode
// variant automatically based on the current theme.
export function BrandLockup({ height = 36, style }: Props) {
  const { isDark } = useTheme();
  const width = height * (1000 / 256);
  return (
    <View testID="brand-lockup" style={[{ height, width }, style]}>
      <Image
        source={isDark ? require("../../assets/images/logo-sombre.png") : require("../../assets/images/brand.png")}
        style={{ width, height, resizeMode: "contain" } as ImageStyle}
      />
    </View>
  );
}
