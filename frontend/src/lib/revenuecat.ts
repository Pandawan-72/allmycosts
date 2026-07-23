// Centralized RevenueCat wrapper.
// Every public billing operation goes through ensurePurchasesReady() so no
// caller can query Google Play before the native SDK has finished configuring.
import { Platform } from "react-native";

export const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || "";
export const RC_ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || "pro";

export type RCPlan = "monthly" | "yearly" | "lifetime";

export type RCPackageInfo = {
  identifier: string;
  packageType: string;
  plan: RCPlan | null;
  priceString: string;
  productIdentifier: string;
  product: any;
  rcPackage: any;
};

let configured = false;
let configuring: Promise<any> | null = null;
let purchasesMod: any | null = null;
let revenueCatLogLevel: any | null = null;

export function isRevenueCatSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

async function loadPurchases(): Promise<any | null> {
  if (!isRevenueCatSupported()) return null;
  if (purchasesMod) return purchasesMod;

  try {
    const mod = await import("react-native-purchases");
    purchasesMod = mod.default ?? mod;
    revenueCatLogLevel = (mod as any).LOG_LEVEL ?? purchasesMod?.LOG_LEVEL ?? null;
    return purchasesMod;
  } catch (error) {
    console.warn("[RC] Unable to load react-native-purchases", error);
    return null;
  }
}

/** Configure RevenueCat exactly once and resolve only when it is ready. */
export async function configureRC(): Promise<any | null> {
  if (!isRevenueCatSupported()) return null;
  if (configured && purchasesMod) return purchasesMod;
  if (configuring) return configuring;

  if (!RC_API_KEY) {
    throw new Error("RevenueCat API key is missing (EXPO_PUBLIC_REVENUECAT_API_KEY).");
  }

  configuring = (async () => {
    const Purchases = await loadPurchases();
    if (!Purchases) {
      throw new Error("RevenueCat native SDK is unavailable in this build.");
    }

    // Verbose logs in development make Play Billing product/configuration
    // problems visible. Production remains quiet apart from warnings/errors.
    if (typeof Purchases.setLogLevel === "function" && revenueCatLogLevel) {
      const level = __DEV__
        ? (revenueCatLogLevel.DEBUG ?? revenueCatLogLevel.INFO)
        : revenueCatLogLevel.WARN;
      if (level != null) Purchases.setLogLevel(level);
    }

    Purchases.configure({ apiKey: RC_API_KEY });
    configured = true;
    return Purchases;
  })();

  try {
    return await configuring;
  } catch (error) {
    configured = false;
    console.warn("[RC] Configuration failed", error);
    throw error;
  } finally {
    configuring = null;
  }
}

async function ensurePurchasesReady(): Promise<any> {
  const Purchases = await configureRC();
  if (!Purchases || !configured) {
    throw new Error("RevenueCat is not available on this platform/build.");
  }
  return Purchases;
}

function planFromPackageType(packageType: unknown): RCPlan | null {
  switch (String(packageType || "").toUpperCase()) {
    case "LIFETIME":
      return "lifetime";
    case "ANNUAL":
      return "yearly";
    case "MONTHLY":
      return "monthly";
    default:
      return null;
  }
}

function getUsableOffering(offerings: any): any | null {
  if (offerings?.current?.availablePackages?.length) return offerings.current;

  // Fallback is useful when the Dashboard contains products but no current
  // offering is resolved (for example after an incomplete/default offering
  // migration). Prefer a literal "default" offering, then the first non-empty
  // one. This keeps the store usable while emitting a diagnostic warning.
  const all = offerings?.all || {};
  const fallback = all.default || Object.values(all).find(
    (offering: any) => offering?.availablePackages?.length,
  );

  if (fallback) {
    console.warn("[RC] No current offering resolved; using a non-empty fallback offering.");
  }
  return fallback || null;
}

export async function fetchOfferingPackages(): Promise<RCPackageInfo[]> {
  const Purchases = await ensurePurchasesReady();
  const offerings = await Purchases.getOfferings();
  const offering = getUsableOffering(offerings);

  if (__DEV__) {
    console.log("[RC] current offering:", offerings?.current?.identifier ?? null);
    console.log("[RC] available offerings:", Object.keys(offerings?.all || {}));
  }

  if (!offering) return [];

  const packages = (offering.availablePackages || []).map((pkg: any) => {
    const product = pkg?.product || {};
    const info: RCPackageInfo = {
      identifier: String(pkg?.identifier || ""),
      packageType: String(pkg?.packageType || "UNKNOWN"),
      plan: planFromPackageType(pkg?.packageType),
      priceString: String(product?.priceString || ""),
      productIdentifier: String(product?.identifier || ""),
      product,
      rcPackage: pkg,
    };

    if (__DEV__) {
      console.log("[RC] package", {
        identifier: info.identifier,
        packageType: info.packageType,
        productIdentifier: info.productIdentifier,
        priceString: info.priceString,
      });
    }
    return info;
  });

  return packages;
}

/**
 * Return the lifetime package for the current offering.
 * RevenueCat's package type is authoritative. For the app's single-product
 * lifetime business model, a sole CUSTOM package is accepted as a safe
 * compatibility fallback so an older Dashboard package identifier cannot hide
 * a perfectly valid Google Play price.
 */
export async function fetchLifetimePackage(): Promise<RCPackageInfo | null> {
  const packages = await fetchOfferingPackages();
  const lifetime = packages.find((pkg) => pkg.plan === "lifetime");
  if (lifetime) return lifetime;

  const nonSubscription = packages.filter(
    (pkg) => String(pkg.product?.productCategory || "").toUpperCase() === "NON_SUBSCRIPTION",
  );
  if (nonSubscription.length === 1) {
    console.warn(
      "[RC] Using the only NON_SUBSCRIPTION product as the lifetime unlock. " +
      "Set its RevenueCat package type to LIFETIME for an exact package match.",
    );
    return { ...nonSubscription[0], plan: "lifetime" };
  }

  if (packages.length === 1) {
    console.warn(
      `[RC] The only package is type ${packages[0].packageType}; treating it as lifetime for backward compatibility. ` +
      "Configure this package as LIFETIME in RevenueCat to remove this fallback.",
    );
    return { ...packages[0], plan: "lifetime" };
  }

  return null;
}

function hasConfiguredEntitlement(customerInfo: any): boolean {
  const active = customerInfo?.entitlements?.active || {};
  const entitled = !!active[RC_ENTITLEMENT_ID];

  if (__DEV__ && !entitled) {
    const activeIds = Object.keys(active);
    if (activeIds.length) {
      console.warn(
        `[RC] Active entitlement(s) found (${activeIds.join(", ")}), but configured ID ` +
        `"${RC_ENTITLEMENT_ID}" is not active. Check EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID.`,
      );
    }
  }

  return entitled;
}

export async function purchaseRCPackage(
  pkg: any,
): Promise<{ entitled: boolean; userCancelled: boolean }> {
  const Purchases = await ensurePurchasesReady();

  try {
    const result = await Purchases.purchasePackage(pkg);
    return { entitled: hasConfiguredEntitlement(result?.customerInfo), userCancelled: false };
  } catch (error: any) {
    if (error?.userCancelled) return { entitled: false, userCancelled: true };
    throw error;
  }
}

export async function restorePurchasesRC(): Promise<boolean> {
  const Purchases = await ensurePurchasesReady();
  const customerInfo = await Purchases.restorePurchases();
  return hasConfiguredEntitlement(customerInfo);
}

export async function getCurrentEntitlement(): Promise<boolean> {
  const Purchases = await ensurePurchasesReady();
  const customerInfo = await Purchases.getCustomerInfo();
  return hasConfiguredEntitlement(customerInfo);
}

/** Keep app state synchronized when RevenueCat updates CustomerInfo. */
export async function subscribeToEntitlementChanges(
  onChange: (isEntitled: boolean) => void,
): Promise<() => void> {
  if (!isRevenueCatSupported()) return () => {};

  const Purchases = await ensurePurchasesReady();
  if (typeof Purchases.addCustomerInfoUpdateListener !== "function") return () => {};

  const listener = (customerInfo: any) => {
    onChange(hasConfiguredEntitlement(customerInfo));
  };

  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    try {
      Purchases.removeCustomerInfoUpdateListener?.(listener);
    } catch {
      // Listener cleanup must never crash route unmounting.
    }
  };
}
