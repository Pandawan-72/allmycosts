const { withAndroidManifest, withGradleProperties } = require("@expo/config-plugins");

/**
 * Keeps critical Android billing/release settings reproducible when Expo/EAS
 * regenerates the native android directory during prebuild.
 */
module.exports = function withAndroidProductionConfig(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const activities = application?.activity || [];
    const mainActivity = activities.find(
      (activity) => activity?.$?.["android:name"] === ".MainActivity",
    );

    // RevenueCat/Google Play Billing recommends standard or singleTop so a
    // payment verification app switch does not cancel the purchase flow.
    if (mainActivity?.$) {
      mainActivity.$["android:launchMode"] = "singleTop";
    }

    return config;
  });

  config = withGradleProperties(config, (config) => {
    const upsert = (key, value) => {
      const existing = config.modResults.find(
        (item) => item.type === "property" && item.key === key,
      );
      if (existing) existing.value = value;
      else config.modResults.push({ type: "property", key, value });
    };

    // R8 + resource shrinking remove unused Java/Kotlin code and Android
    // resources from release AABs. Expo documents these two flags as paired.
    upsert("android.enableMinifyInReleaseBuilds", "true");
    upsert("android.enableShrinkResourcesInReleaseBuilds", "true");

    return config;
  });

  return config;
};
