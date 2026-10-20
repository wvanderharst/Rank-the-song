// Extends app.json.

// ── iPhone AdMob ids ────────────────────────────────────────────────────────
// Fill in the App ID of your iOS app from AdMob (Apps → your iOS app → App
// settings). Also fill in IOS_AD_UNIT_ID in client/lib/ads.ts.
// While this still contains "X", Google's sample iOS app id is used and iPhone
// release builds show no ads.
const IOS_ADMOB_APP_ID = "ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX";
const SAMPLE_IOS_ADMOB_APP_ID = "ca-app-pub-3940256099942544~1458002511";

function withIosAdMobAppId(plugins = []) {
  const iosAppId = IOS_ADMOB_APP_ID.includes("X") ? SAMPLE_IOS_ADMOB_APP_ID : IOS_ADMOB_APP_ID;
  return plugins.map((plugin) =>
    Array.isArray(plugin) && plugin[0] === "react-native-google-mobile-ads"
      ? [plugin[0], { ...plugin[1], iosAppId }]
      : plugin,
  );
}

// WEB_BASE_PATH sets the URL path the web build is served from, e.g.
// "/Rank-the-song" on GitHub Pages; leave it unset for a root domain.
module.exports = ({ config }) => ({
  ...config,
  plugins: withIosAdMobAppId(config.plugins),
  experiments: {
    ...config.experiments,
    ...(process.env.WEB_BASE_PATH ? { baseUrl: process.env.WEB_BASE_PATH } : {}),
  },
});
