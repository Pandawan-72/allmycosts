import { View, Text, StyleSheet } from "react-native";

type Props = {
  size?: number;
  bg?: string;
  border?: string;
  textColor?: string;
};

export function CoinLogo({
  size = 40,
  bg = "#F9FAFB",
  border = "#111827",
  textColor = "#111827",
}: Props) {
  const outer = size;
  const inner = size * 0.78;
  const fontSize = size * 0.5;
  return (
    <View
      testID="coin-logo"
      style={[
        styles.outer,
        {
          width: outer,
          height: outer,
          borderRadius: outer / 2,
          borderColor: border,
          backgroundColor: bg,
        },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            borderColor: border,
            opacity: 0.35,
          },
        ]}
      />
      <Text style={[styles.text, { fontSize, color: textColor }]}>?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    position: "absolute",
    borderWidth: 1,
  },
  text: {
    fontWeight: "900",
    fontFamily: "System",
    includeFontPadding: false,
    lineHeight: undefined,
  },
});
