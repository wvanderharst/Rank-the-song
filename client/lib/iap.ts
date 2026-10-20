import { Platform } from "react-native";

const REMOVE_ADS_PRODUCT_ID = "remove_ads";

let iapModule: any = null;
let isPurchased = false;
let isIAPInitialized = false;
let initPromise: Promise<void> | null = null;
let purchaseListener: ((purchase: any) => void) | null = null;

async function loadIAPModule(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  try {
    const module = await import("expo-iap");
    iapModule = module;
    return true;
  } catch (error) {
    console.log("IAP module not available:", error);
    return false;
  }
}

export async function initializeIAP(onPurchaseComplete?: (productId: string, success: boolean) => void): Promise<void> {
  if (Platform.OS === "web") {
    console.log("IAP disabled on web platform");
    return;
  }

  if (isIAPInitialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const loaded = await loadIAPModule();
    if (!loaded || !iapModule) {
      console.log("IAP module not loaded");
      return;
    }

    try {
      await iapModule.initConnection();
      console.log("IAP connected successfully");
      
      if (onPurchaseComplete) {
        purchaseListener = async (purchase: any) => {
          if (purchase.productId === REMOVE_ADS_PRODUCT_ID) {
            isPurchased = true;
            onPurchaseComplete(purchase.productId, true);
          }
        };
      }
      
      await restorePurchases();
      isIAPInitialized = true;
    } catch (error) {
      console.log("IAP initialization failed:", error);
    }
  })();

  return initPromise;
}

export async function ensureIAPReady(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }

  if (isIAPInitialized && iapModule) {
    return true;
  }

  await initializeIAP();
  return isIAPInitialized && iapModule !== null;
}

export async function restorePurchases(): Promise<boolean> {
  if (!iapModule || Platform.OS === "web") {
    return false;
  }

  try {
    const history = await iapModule.getPurchaseHistory();
    
    if (history && Array.isArray(history)) {
      const hasRemoveAds = history.some(
        (purchase: any) => purchase.productId === REMOVE_ADS_PRODUCT_ID
      );
      isPurchased = hasRemoveAds;
      return hasRemoveAds;
    }
  } catch (error) {
    console.log("Failed to restore purchases:", error);
  }

  return false;
}

export async function purchaseRemoveAds(): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log("IAP not available on this platform");
    return false;
  }

  const ready = await ensureIAPReady();
  if (!ready || !iapModule) {
    console.log("IAP not initialized");
    return false;
  }

  try {
    const products = await iapModule.getProducts([REMOVE_ADS_PRODUCT_ID]);
    
    if (!products || products.length === 0) {
      console.log("Product not found");
      return false;
    }

    const purchase = await iapModule.requestPurchase(REMOVE_ADS_PRODUCT_ID);
    
    if (purchase) {
      await iapModule.finishTransaction({ 
        purchase, 
        isConsumable: false 
      });
      isPurchased = true;
      
      if (purchaseListener) {
        purchaseListener(purchase);
      }
      
      return true;
    }
    
    return false;
  } catch (error: any) {
    if (error?.code === "E_USER_CANCELLED") {
      console.log("Purchase cancelled by user");
    } else {
      console.log("Purchase failed:", error);
    }
    return false;
  }
}

export function isRemoveAdsPurchased(): boolean {
  return isPurchased;
}

export function isIAPAvailable(): boolean {
  return Platform.OS !== "web";
}

export async function disconnectIAP(): Promise<void> {
  if (iapModule && Platform.OS !== "web") {
    try {
      await iapModule.endConnection();
    } catch (error) {
      console.log("Failed to disconnect IAP:", error);
    }
  }
}
