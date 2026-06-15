import { Image, ImageStyle, StyleProp, View, ViewStyle } from "react-native";

type Props = {
  height?: number;
  style?: StyleProp<ViewStyle>;
};

// Wide brand lockup: coin emblem + "All My Costs" text baked in.
// Source image aspect ratio ~3.9:1 (1000x256).
export function BrandLockup({ height = 36, style }: Props) {
  const width = height * (1000 / 256);
  return (
    <View testID="brand-lockup" style={[{ height, width }, style]}>
      <Image
        source={require("../../assets/images/brand.png")}
        style={{ width, height, resizeMode: "contain" } as ImageStyle}
      />
    </View>
  );
}
