// RevenueCat wrapper. The native module from `react-native-purchases` does not
// work on web (no native code). We lazy-load it only on iOS/Android.
import { Platform } from "react-native";

export const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "";
export const RC_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro";

export type RCPlan = "monthly" | "yearly" | "lifetime";

export type RCPackageInfo = {
  identifier: string;
  plan: RCPlan;
  priceString: string;
  product: any;
  rcPackage: any;
};

let configured = false;
let purchasesMod: any | null = null;

export function isRevenueCatSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function loadPurchases(): Promise<any | null> {
  if (!isRevenueCatSupported()) return null;
  if (purchasesMod) return purchasesMod;
  try {
    const mod = await import("react-native-purchases");
    purchasesMod = mod.default ?? mod;
    return purchasesMod;
  } catch (e) {
    console.warn("[RC] Failed to load react-native-purchases", e);
    return null;
  }
}

export async function configureRC(appUserId?: string | null) {
  if (configured) return;
  if (!RC_API_KEY) {
    console.warn("[RC] EXPO_PUBLIC_REVENUECAT_API_KEY missing");
    return;
  }
  const P = await loadPurchases();
  if (!P) return; // web fallback
  try {
    if (typeof P.setLogLevel === "function" && P.LOG_LEVEL) {
      P.setLogLevel(P.LOG_LEVEL.WARN);
    }
    P.configure({ apiKey: RC_API_KEY, appUserID: appUserId ?? null });
    configured = true;
  } catch (e) {
    console.warn("[RC] configure failed", e);
  }
}

export async function loginRC(appUserId: string) {
  const P = await loadPurchases();
  if (!P || !configured) return null;
  try {
    return await P.logIn(appUserId);
  } catch (e) {
    console.warn("[RC] logIn failed", e);
    return null;
  }
}

export async function logoutRC() {
  const P = await loadPurchases();
  if (!P || !configured) return;
  try {
    await P.logOut();
  } catch (e) {
    // anonymous user — safe to ignore
  }
}

function inferPlanFromIdentifier(id: string, productId: string): RCPlan {
  const s = `${id} ${productId}`.toLowerCase();
  if (s.includes("lifetime") || s.includes("life")) return "lifetime";
  if (s.includes("annual") || s.includes("year")) return "yearly";
  return "monthly";
}

export async function fetchOfferingPackages(): Promise<RCPackageInfo[]> {
  const P = await loadPurchases();
  if (!P || !configured) return [];
  try {
    const offerings = await P.getOfferings();
    const current = offerings?.current;
    if (!current) return [];
    const packs = current.availablePackages || [];
    return packs.map((pkg: any) => {
      const product = pkg.product || {};
      const plan = inferPlanFromIdentifier(pkg.identifier || "", product.identifier || "");
      return {
        identifier: pkg.identifier,
        plan,
        priceString: product.priceString || "",
        product,
        rcPackage: pkg,
      } as RCPackageInfo;
    });
  } catch (e) {
    console.warn("[RC] getOfferings failed", e);
    return [];
  }
}

export async function purchaseRCPackage(pkg: any): Promise<{ entitled: boolean; userCancelled: boolean }> {
  const P = await loadPurchases();
  if (!P || !configured) return { entitled: false, userCancelled: false };
  try {
    const result = await P.purchasePackage(pkg);
    const ent = result?.customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    return { entitled: !!ent, userCancelled: false };
  } catch (e: any) {
    if (e?.userCancelled) return { entitled: false, userCancelled: true };
    throw e;
  }
}

export async function restorePurchasesRC(): Promise<boolean> {
  const P = await loadPurchases();
  if (!P || !configured) return false;
  try {
    const info = await P.restorePurchases();
    const ent = info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
    return !!ent;
  } catch (e) {
    console.warn("[RC] restore failed", e);
    return false;
  }
}

export async function getCurrentEntitlement(): Promise<boolean> {
  const P = await loadPurchases();
  if (!P || !configured) return false;
  try {
    const info = await P.getCustomerInfo();
    return !!info?.entitlements?.active?.[RC_ENTITLEMENT_ID];
  } catch {
    return false;
  }
}
