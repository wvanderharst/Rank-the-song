import React, { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { Spacing } from "@/constants/theme";

// Google AdSense ids, set at build time (see .github/workflows/deploy-pages.yml).
const ADSENSE_CLIENT = process.env.EXPO_PUBLIC_ADSENSE_CLIENT;
const ADSENSE_SLOT = process.env.EXPO_PUBLIC_ADSENSE_SLOT;

const SCRIPT_ID = "adsbygoogle-js";

function loadAdSenseScript(client: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.appendChild(script);
}

/**
 * Responsive AdSense banner. Renders nothing on iOS/Android or when the
 * AdSense ids are not configured.
 */
export function AdBanner() {
  const pushed = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !ADSENSE_CLIENT || !ADSENSE_SLOT || pushed.current) return;
    loadAdSenseScript(ADSENSE_CLIENT);
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      pushed.current = true;
    } catch (error) {
      console.error("AdSense failed to load:", error);
    }
  }, []);

  if (Platform.OS !== "web" || !ADSENSE_CLIENT || !ADSENSE_SLOT) {
    return null;
  }

  return (
    <View style={styles.container}>
      {React.createElement("ins", {
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
    marginTop: "auto",
    paddingTop: Spacing.md,
    minHeight: 50,
  },
});
