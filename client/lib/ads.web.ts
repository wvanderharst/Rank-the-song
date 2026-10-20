// Web build of ads.ts: AdMob (react-native-google-mobile-ads) only runs in the
// native app and cannot be bundled for web. The website shows <AdBanner /> instead.

export async function initializeAds(): Promise<void> {}

export function shouldShowAd(
  _adsDisabled: boolean,
  _songsSinceLastAd: number,
  _lastAdTimestamp: number,
  _includingCurrentSong: boolean = false
): boolean {
  return false;
}

export async function showInterstitialAd(): Promise<boolean> {
  return false;
}

export function isAdsAvailable(): boolean {
  return false;
}
