import { Platform } from "react-native";

// Real interstitial ad unit per platform. Fill in IOS_AD_UNIT_ID with the
// interstitial ad unit of your iOS app in AdMob (and IOS_ADMOB_APP_ID in
// app.config.js). While it still contains "X", iPhone release builds show no ads.
const ANDROID_AD_UNIT_ID = "ca-app-pub-1303789001048468/1137972134";
const IOS_AD_UNIT_ID = "ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX";
const AD_UNIT_ID =
  Platform.OS === "ios"
    ? (IOS_AD_UNIT_ID.includes("X") ? "" : IOS_AD_UNIT_ID)
    : ANDROID_AD_UNIT_ID;
const TEST_AD_UNIT_ID = "ca-app-pub-3940256099942544/1033173712";
const RETRY_AFTER_ERROR_MS = 60 * 1000;

const SONGS_BETWEEN_ADS = 4;
const MIN_AD_INTERVAL_MS = 4 * 60 * 1000;

let interstitialAd: any = null;
let adLoaded = false;
let mobileAdsModule: any = null;
let InterstitialAdClass: any = null;
let AdEventType: any = null;
let TestIds: any = null;

async function loadAdModules(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const module = await import("react-native-google-mobile-ads");
    mobileAdsModule = module.default;
    InterstitialAdClass = module.InterstitialAd;
    AdEventType = module.AdEventType;
    TestIds = module.TestIds;
    return true;
  } catch (error) {
    console.log("AdMob not available:", error);
    return false;
  }
}

export async function initializeAds(): Promise<void> {
  if (Platform.OS === "web") {
    console.log("Ads disabled on web platform");
    return;
  }

  const loaded = await loadAdModules();
  if (!loaded || !mobileAdsModule) {
    console.log("AdMob module not loaded");
    return;
  }

  try {
    await mobileAdsModule().initialize();
    console.log("AdMob initialized successfully");
    await preloadInterstitial();
  } catch (error) {
    console.log("AdMob initialization failed:", error);
  }
}

async function preloadInterstitial(): Promise<void> {
  if (!InterstitialAdClass) return;

  const adUnitId = __DEV__ ? (TestIds?.INTERSTITIAL || TEST_AD_UNIT_ID) : AD_UNIT_ID;
  if (!adUnitId) {
    console.log(`No AdMob ad unit configured for ${Platform.OS}`);
    return;
  }

  try {
    interstitialAd = InterstitialAdClass.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      adLoaded = true;
      console.log("Interstitial ad loaded");
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      adLoaded = false;
      preloadInterstitial();
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      console.log("Interstitial ad error:", error);
      adLoaded = false;
      // Usually "no fill"; try again later instead of waiting for the next show.
      setTimeout(preloadInterstitial, RETRY_AFTER_ERROR_MS);
    });

    interstitialAd.load();
  } catch (error) {
    console.log("Failed to create interstitial ad:", error);
  }
}

export function shouldShowAd(
  adsDisabled: boolean,
  songsSinceLastAd: number,
  lastAdTimestamp: number,
  includingCurrentSong: boolean = false
): boolean {
  if (Platform.OS === "web") {
    return false;
  }

  if (adsDisabled) {
    return false;
  }

  const effectiveSongCount = includingCurrentSong ? songsSinceLastAd + 1 : songsSinceLastAd;
  const timeSinceLastAd = Date.now() - lastAdTimestamp;
  const enoughTimePassed = timeSinceLastAd >= MIN_AD_INTERVAL_MS;
  const enoughSongsPlayed = effectiveSongCount >= SONGS_BETWEEN_ADS;

  return enoughSongsPlayed && enoughTimePassed;
}

export async function showInterstitialAd(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  if (!interstitialAd || !adLoaded) {
    console.log("Interstitial ad not ready");
    preloadInterstitial();
    return false;
  }

  try {
    await interstitialAd.show();
    return true;
  } catch (error) {
    console.log("Failed to show interstitial ad:", error);
    return false;
  }
}

export function isAdsAvailable(): boolean {
  return Platform.OS !== "web";
}
