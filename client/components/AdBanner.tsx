import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";

// Google AdSense ids, set at build time (see .github/workflows/deploy-pages.yml).
// Without them, Google's public test banner is shown instead.
const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;
const ADSENSE_SLOT = process.env.EXPO_PUBLIC_ADSENSE_SLOT;
const USE_TEST_AD = !ADSENSE_CLIENT || !ADSENSE_SLOT;

// Google Ad Manager's public sample ad unit; serves test creatives on any site.
const TEST_AD_UNIT = "/6355419/Travel/Europe/France/Paris";
const TEST_AD_SIZE: [number, number] = [300, 250];
const TEST_AD_DIV_ID = "test-ad-banner";

function loadScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = src;
  document.head.appendChild(script);
}

function showAdSenseAd() {
  loadScript(
    "adsbygoogle-js",
    `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`,
  );
  ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
  return () => {};
}

function showTestAd() {
  loadScript("gpt-js", "https://securepubads.g.doubleclick.net/tag/js/gpt.js");
  const w = window as any;
  w.googletag = w.googletag || { cmd: [] };
  let slot: any = null;
  w.googletag.cmd.push(() => {
    slot = w.googletag
      .defineSlot(TEST_AD_UNIT, TEST_AD_SIZE, TEST_AD_DIV_ID)
      ?.addService(w.googletag.pubads());
    w.googletag.enableServices();
    w.googletag.display(TEST_AD_DIV_ID);
  });
  return () => {
    w.googletag.cmd.push(() => {
      if (slot) w.googletag.destroySlots([slot]);
    });
  };
}

/**
 * Banner ad at the bottom of the web app. Renders nothing on iOS/Android.
 */
export function AdBanner() {
  const shown = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || shown.current) return;
    shown.current = true;
    try {
      const cleanup = USE_TEST_AD ? showTestAd() : showAdSenseAd();
      return () => {
        shown.current = false;
        cleanup();
      };
    } catch (error) {
      console.error("Ad failed to load:", error);
    }
  }, []);

  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View style={styles.container}>
      {USE_TEST_AD
        ? React.createElement("div", {
            id: TEST_AD_DIV_ID,
            style: { width: TEST_AD_SIZE[0], height: TEST_AD_SIZE[1] },
          })
        : React.createElement("ins", {
            className: "adsbygoogle",
            style: { display: "block", width: "100%" },
            "data-ad-client": ADSENSE_CLIENT,
            "data-ad-slot": ADSENSE_SLOT,
            "data-ad-format": "auto",
            "data-full-width-responsive": "true",
          })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    marginTop: "auto",
    paddingTop: Spacing.md,
    minHeight: 50,
  },
});
