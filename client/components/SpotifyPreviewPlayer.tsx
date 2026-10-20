import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

// Spotify's embed player, controlled through its iFrame API. It needs no login:
// listeners who are not logged in to Spotify in this browser hear a 30-second
// preview. The embed itself shows the song title and cover, so it stays hidden
// behind our own Play/Pause controls unless the player asks to see it.
const IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";
const SPOTIFY_GREEN = "#1DB954";

let iframeApiPromise: Promise<any> | null = null;

function loadIframeApi(): Promise<any> {
  if (!iframeApiPromise) {
    iframeApiPromise = new Promise((resolve) => {
      const w = window as any;
      w.onSpotifyIframeApiReady = (api: any) => resolve(api);
      const script = document.createElement("script");
      script.src = IFRAME_API_SRC;
      script.async = true;
      document.body.appendChild(script);
    });
  }
  return iframeApiPromise;
}

function formatTime(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function SpotifyPreviewPlayer({
  spotifyUri,
  compact = false,
}: {
  spotifyUri: string | null;
  compact?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<any>(null);
  const loadedUriRef = useRef<string | null>(null);
  // Once the player has pressed Play, later songs start playing by themselves.
  const hasStartedRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showEmbed, setShowEmbed] = useState(false);

  // Create the hidden embed once.
  useEffect(() => {
    if (Platform.OS !== "web" || !hostRef.current || !spotifyUri) return;
    if (controllerRef.current) return;

    let cancelled = false;
    const target = document.createElement("div");
    hostRef.current.appendChild(target);

    loadIframeApi().then((api) => {
      if (cancelled) return;
      api.createController(
        target,
        { uri: spotifyUri, width: "100%", height: 80 },
        (controller: any) => {
          if (cancelled) {
            controller.destroy();
            return;
          }
          controllerRef.current = controller;
          loadedUriRef.current = spotifyUri;
          controller.addListener("ready", () => setIsReady(true));
          controller.addListener("playback_update", (e: any) => {
            setIsPaused(e.data.isPaused);
            setPosition(e.data.position);
            setDuration(e.data.duration);
          });
        },
      );
    });

    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      loadedUriRef.current = null;
    };
    // Only the first song creates the embed; later songs are loaded below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotifyUri !== null]);

  // Load the next song into the existing embed.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !spotifyUri || loadedUriRef.current === spotifyUri) return;

    loadedUriRef.current = spotifyUri;
    setPosition(0);
    setDuration(0);
    setIsPaused(true);
    controller.loadUri(spotifyUri);
    if (hasStartedRef.current) {
      // Give the embed a moment to switch tracks before starting it.
      setTimeout(() => controller.play(), 600);
    }
  }, [spotifyUri]);

  const handlePlayPause = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    hasStartedRef.current = true;
    controller.togglePlay();
  };

  if (Platform.OS !== "web") {
    return (
      <View style={[styles.container, compact && styles.compact]}>
        <ThemedText style={styles.text}>Spotify preview is available on the website.</ThemedText>
      </View>
    );
  }

  if (!spotifyUri) {
    return (
      <View style={[styles.container, compact && styles.compact]}>
        <ThemedText style={styles.text}>No Spotify preview for this song.</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={[styles.controls, compact && styles.controlsCompact]}>
        <Pressable
          style={[styles.playButton, compact && styles.playButtonCompact]}
          onPress={handlePlayPause}
          disabled={!isReady}
        >
          {isReady ? (
            <ThemedText style={[styles.playLabel, compact && styles.playLabelCompact]}>
              {isPaused ? "Play" : "Pause"}
            </ThemedText>
          ) : (
            <ActivityIndicator size="small" color={SPOTIFY_GREEN} />
          )}
        </Pressable>
        <View style={styles.info}>
          <ThemedText style={styles.text}>
            {duration > 0 ? `${formatTime(position)} / ${formatTime(duration)}` : "Spotify preview"}
          </ThemedText>
          {!compact ? (
            <Pressable onPress={() => setShowEmbed((shown) => !shown)}>
              <ThemedText style={styles.link}>
                {showEmbed ? "Hide Spotify player" : "Not playing? Show the Spotify player (reveals the song)"}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
      {React.createElement("div", {
        ref: hostRef,
        style: showEmbed
          ? { width: "100%", height: 80, marginTop: Spacing.sm }
          : { position: "absolute", width: 300, height: 80, opacity: 0, pointerEvents: "none" },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    minHeight: 120,
    borderRadius: BorderRadius.sm,
    backgroundColor: SPOTIFY_GREEN,
    justifyContent: "center",
    padding: Spacing.md,
    overflow: "hidden",
  },
  compact: {
    minHeight: 60,
    paddingVertical: Spacing.sm,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  controlsCompact: {
    justifyContent: "center",
  },
  playButton: {
    width: 80,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  playButtonCompact: {
    width: 64,
    height: 40,
    borderRadius: 20,
  },
  playLabel: {
    color: SPOTIFY_GREEN,
    fontSize: 18,
    fontWeight: "700",
  },
  playLabelCompact: {
    fontSize: 14,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  link: {
    color: "#FFFFFF",
    fontSize: 12,
    opacity: 0.8,
    textDecorationLine: "underline",
    marginTop: Spacing.xs,
  },
});
