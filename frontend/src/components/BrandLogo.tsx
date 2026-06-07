import { Image, ImageStyle, StyleProp, View, ViewStyle } from "react-native";

type Props = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

// Brand logo using the user-provided coin-with-? PNG.
export function BrandLogo({ size = 40, style }: Props) {
  return (
    <View
      testID="brand-logo"
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
        },
        style,
      ]}
    >
      <Image
        source={require("../../assets/images/icon.png")}
        style={{ width: size, height: size, resizeMode: "contain" } as ImageStyle}
      />
    </View>
  );
}
