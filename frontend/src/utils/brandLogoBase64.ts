import { Platform } from "react-native";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";

let _cached: string | null = null;

export async function getBrandLogoBase64(): Promise<string> {
  if (_cached) return _cached;
  try {
    const asset = Asset.fromModule(require("../../assets/images/icon.png"));
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (Platform.OS === "web") {
      const r = await fetch(uri);
      const blob = await r.blob();
      const b64 = await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(((fr.result as string) || "").split(",")[1] || "");
        fr.readAsDataURL(blob);
      });
      _cached = b64;
    } else {
      _cached = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
  } catch {
    _cached = "";
  }
  return _cached || "";
}
