import { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import { useSettings } from "@/context/SettingsContext";
import { initializeAds, shouldShowAd, showInterstitialAd, isAdsAvailable } from "@/lib/ads";
import { initializeIAP, restorePurchases, purchaseRemoveAds, isIAPAvailable } from "@/lib/iap";

let adsInitialized = false;
let iapInitialized = false;

export function useAdsInitialization() {
  const { setAdsDisabled } = useSettings();

  useEffect(() => {
    async function init() {
      if (Platform.OS === "web") {
        return;
      }

      if (!adsInitialized) {
        await initializeAds();
        adsInitialized = true;
      }

      if (!iapInitialized) {
        await initializeIAP((productId, success) => {
          if (productId === "remove_ads" && success) {
            setAdsDisabled(true);
          }
        });
        const hasPurchased = await restorePurchases();
        if (hasPurchased) {
          setAdsDisabled(true);
        }
        iapInitialized = true;
      }
    }

    init();
  }, [setAdsDisabled]);
}

export function useAdManager() {
  const { adsDisabled, songsSinceLastAd, lastAdTimestamp, incrementSongCount, resetAdCounters } = useSettings();

  const onSongLoaded = useCallback(() => {
    if (Platform.OS === "web" || adsDisabled) {
      return;
    }
    incrementSongCount();
  }, [adsDisabled, incrementSongCount]);

  const tryShowAd = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      return false;
    }

    if (!shouldShowAd(adsDisabled, songsSinceLastAd, lastAdTimestamp, true)) {
      return false;
    }

    const shown = await showInterstitialAd();
    if (shown) {
      resetAdCounters();
    }
    return shown;
  }, [adsDisabled, songsSinceLastAd, lastAdTimestamp, resetAdCounters]);

  return {
    onSongLoaded,
    tryShowAd,
    isAdsAvailable: isAdsAvailable(),
    adsDisabled,
  };
}

export function useRemoveAdsPurchase() {
  const { setAdsDisabled } = useSettings();

  const purchase = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      return false;
    }

    const success = await purchaseRemoveAds();
    if (success) {
      setAdsDisabled(true);
    }
    return success;
  }, [setAdsDisabled]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web") {
      return false;
    }

    const hasPurchased = await restorePurchases();
    if (hasPurchased) {
      setAdsDisabled(true);
    }
    return hasPurchased;
  }, [setAdsDisabled]);

  return {
    purchaseRemoveAds: purchase,
    restorePurchases: restore,
    isIAPAvailable: isIAPAvailable(),
  };
}
