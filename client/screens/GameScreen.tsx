import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useSettings } from "@/context/SettingsContext";
import { useSpotifyAuth } from "@/context/SpotifyAuthContext";
import { Song } from "@shared/songs-data";
import { getRandomSong as getRandomSongFromList, getSongCount } from "@/lib/song-manager";
import { useAdManager } from "@/hooks/useAds";
import { AdBanner } from "@/components/AdBanner";
import { SpotifyPreviewPlayer } from "@/components/SpotifyPreviewPlayer";
import { YouTubeSongPlayer } from "@/components/YouTubeSongPlayer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PLAYER_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const PLAYER_HEIGHT = (PLAYER_WIDTH * 9) / 16;

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

function GameButton({
  onPress,
  title,
  variant = "primary",
  disabled = false,
}: {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, springConfig);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const isPrimary = variant === "primary";

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[
          styles.button,
          isPrimary
            ? { backgroundColor: theme.primary }
            : {
                backgroundColor: "transparent",
                borderWidth: 2,
                borderColor: theme.primary,
              },
          disabled && { opacity: 0.5 },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          if (!disabled) onPress();
        }}
        disabled={disabled}
      >
        <ThemedText
          style={[
            styles.buttonText,
            { color: isPrimary ? Colors.light.buttonText : theme.primary },
          ]}
        >
          {title}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

type SpotifyDevice = {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
};

function SpotifyPlayer({ spotifyUri, artist, title, onSongChange }: { 
  spotifyUri: string | null; 
  artist: string; 
  title: string;
  onSongChange?: () => void;
}) {
  const { theme } = useTheme();
  const { isAuthenticated, getValidAccessToken } = useSpotifyAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDevices, setShowDevices] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [devicesFetched, setDevicesFetched] = useState(false);
  const previousUri = useRef<string | null>(null);

  const getSpotifyTrackId = (uri: string | null): string | null => {
    if (!uri) return null;
    const match = uri.match(/spotify:track:([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const trackId = getSpotifyTrackId(spotifyUri);
  
  console.log("[SpotifyPlayer] Rendering with:", { 
    isAuthenticated, 
    spotifyUri, 
    trackId, 
    devicesCount: devices.length, 
    error 
  });

  const fetchDevices = async () => {
    console.log("[SpotifyPlayer] fetchDevices called");
    setError(null);
    setDevicesFetched(false);
    try {
      const token = await getValidAccessToken();
      console.log("[SpotifyPlayer] Got token:", token ? "yes" : "no");
      if (!token) {
        setError("Please connect Spotify in Settings");
        setDevicesFetched(true);
        return;
      }
      
      const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      console.log("[SpotifyPlayer] Devices response status:", response.status);
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.log("[SpotifyPlayer] Devices error body:", errorBody);
        if (response.status === 401) {
          setError("Session expired. Please reconnect Spotify in Settings");
        } else if (response.status === 403) {
          setError("Missing permissions. Please reconnect Spotify");
        } else {
          setError("Could not connect to Spotify");
        }
        setDevicesFetched(true);
        return;
      }
      
      const data = await response.json();
      console.log("[SpotifyPlayer] Devices found:", data.devices?.length || 0);
      setDevices(data.devices || []);
      setDevicesFetched(true);
      const activeDevice = data.devices?.find((d: SpotifyDevice) => d.is_active);
      if (activeDevice) {
        setSelectedDevice(activeDevice.id);
      } else if (data.devices?.length > 0) {
        setSelectedDevice(data.devices[0].id);
      }
    } catch (err: any) {
      setError("Could not connect to Spotify");
      setDevicesFetched(true);
      console.error("[SpotifyPlayer] Failed to fetch devices:", err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDevices();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (spotifyUri && spotifyUri !== previousUri.current) {
      previousUri.current = spotifyUri;
      if (hasAutoPlayed && isAuthenticated && devices.length > 0) {
        handlePlay();
      }
    }
  }, [spotifyUri, hasAutoPlayed, isAuthenticated, devices.length]);

  const handlePlay = async () => {
    if (!spotifyUri) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = await getValidAccessToken();
      if (!token) {
        setError("Please connect Spotify in Settings");
        setIsLoading(false);
        return;
      }
      
      const url = selectedDevice 
        ? `https://api.spotify.com/v1/me/player/play?device_id=${selectedDevice}`
        : "https://api.spotify.com/v1/me/player/play";
        
      const response = await fetch(url, {
        method: "PUT",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [spotifyUri] }),
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("No active device. Open Spotify on a device first");
        } else if (response.status === 401) {
          setError("Session expired. Please reconnect Spotify");
        } else {
          setError("Failed to play track");
        }
      } else {
        setIsPlaying(true);
        setHasAutoPlayed(true);
      }
    } catch (err: any) {
      setError("Failed to play track");
      console.error("Play error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    
    try {
      const token = await getValidAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      
      const url = selectedDevice 
        ? `https://api.spotify.com/v1/me/player/pause?device_id=${selectedDevice}`
        : "https://api.spotify.com/v1/me/player/pause";
        
      await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsPlaying(false);
    } catch (err) {
      console.error("Pause error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openSpotify = async () => {
    if (trackId) {
      const webUrl = `https://open.spotify.com/track/${trackId}`;
      try {
        await Linking.openURL(webUrl);
      } catch (error) {
        console.error("Failed to open Spotify:", error);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.spotifyContainer, { backgroundColor: "#1DB954" }]}>
        <ThemedText style={styles.spotifyTitle}>
          Connect Your Spotify
        </ThemedText>
        <ThemedText style={[styles.spotifySubtext, { color: "#FFFFFF", opacity: 0.8 }]}>
          Go to Settings to connect your Spotify account
        </ThemedText>
      </View>
    );
  }

  if (!trackId) {
    return (
      <View style={[styles.spotifyContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={[styles.spotifyMessage, { color: theme.textSecondary }]}>
          Spotify link not available for this song
        </ThemedText>
        <ThemedText style={[styles.spotifySubtext, { color: theme.textSecondary }]}>
          Switch to YouTube mode in Settings
        </ThemedText>
      </View>
    );
  }

  if (!devicesFetched) {
    return (
      <View style={[styles.spotifyContainer, { backgroundColor: "#1DB954" }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <ThemedText style={styles.spotifyTitle}>
          Connecting to Spotify...
        </ThemedText>
      </View>
    );
  }

  if (error || devices.length === 0) {
    return (
      <View style={[styles.spotifyContainer, { backgroundColor: "#1DB954" }]}>
        <ThemedText style={styles.spotifyTitle}>
          {error || "No active Spotify devices"}
        </ThemedText>
        <ThemedText style={[styles.spotifySubtext, { color: "#FFFFFF", opacity: 0.8 }]}>
          Open Spotify on any device first
        </ThemedText>
        <View style={styles.spotifyButtonRow}>
          <Pressable style={styles.spotifyButton} onPress={fetchDevices}>
            <ThemedText style={styles.spotifyButtonText}>Retry</ThemedText>
          </Pressable>
          <Pressable style={styles.spotifyButton} onPress={openSpotify}>
            <ThemedText style={styles.spotifyButtonText}>Open Spotify</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  const selectedDeviceName = devices.find(d => d.id === selectedDevice)?.name || "Select device";

  return (
    <View style={[styles.spotifyContainer, { backgroundColor: "#1DB954" }]}>
      <View style={styles.spotifyControls}>
        <View style={styles.deviceRow}>
          <Pressable 
            style={[styles.deviceSelector, { flex: 1 }]}
            onPress={() => setShowDevices(!showDevices)}
          >
            <ThemedText style={styles.deviceText} numberOfLines={1}>
              {selectedDeviceName}
            </ThemedText>
            <ThemedText style={{ color: "#FFFFFF", fontSize: 14 }}>
              {showDevices ? "v" : ">"}
            </ThemedText>
          </Pressable>
          <Pressable style={styles.retryButton} onPress={fetchDevices}>
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </View>
        
        {showDevices ? (
          <View style={styles.deviceList}>
            {devices.map((device) => (
              <Pressable
                key={device.id}
                style={[
                  styles.deviceItem,
                  device.id === selectedDevice && styles.deviceItemSelected,
                ]}
                onPress={() => {
                  setSelectedDevice(device.id);
                  setShowDevices(false);
                }}
              >
                <ThemedText 
                  style={[
                    styles.deviceItemText,
                    device.id === selectedDevice && styles.deviceItemTextSelected,
                  ]}
                >
                  {device.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        style={styles.playButton}
        onPress={isPlaying ? handlePause : handlePlay}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#1DB954" />
        ) : (
          <ThemedText style={{ color: "#1DB954", fontSize: 18, fontWeight: "700" }}>
            {isPlaying ? "Pause" : "Play"}
          </ThemedText>
        )}
      </Pressable>

      <ThemedText style={styles.spotifyNowPlaying}>
        {isPlaying ? "Playing on Spotify" : "Tap to play"}
      </ThemedText>
    </View>
  );
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const { playMode, addToHistory, songHistory } = useSettings();
  const { onSongLoaded, tryShowAd } = useAdManager();

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoadingSong, setIsLoadingSong] = useState(false);

  const pickRandomSong = useCallback((excludeCurrentId?: number): Song | null => {
    const historyIds = new Set(songHistory.map(s => s.id));
    if (excludeCurrentId !== undefined) {
      historyIds.add(excludeCurrentId);
    }
    
    const totalSongs = getSongCount();
    const shouldAvoidDuplicates = historyIds.size < totalSongs * 0.7;
    
    return getRandomSongFromList(shouldAvoidDuplicates ? historyIds : undefined);
  }, [songHistory]);

  const handleNextSong = useCallback(() => {
    const newSong = pickRandomSong(currentSong?.id);
    if (newSong) {
      setCurrentSong(newSong);
      setIsRevealed(false);
    }
  }, [pickRandomSong, currentSong?.id]);


  const handleReveal = () => {
    setIsRevealed(true);
  };

  useEffect(() => {
    if (!currentSong) {
      const initialSong = pickRandomSong();
      if (initialSong) {
        setCurrentSong(initialSong);
      }
    }
  }, []);


  useEffect(() => {
    if (currentSong) {
      addToHistory({
        id: currentSong.id,
        placement: currentSong.placement,
        artist: currentSong.artist,
        title: currentSong.title,
        year: currentSong.year,
      });
      onSongLoaded();
      tryShowAd();
    }
  }, [currentSong, addToHistory, onSongLoaded, tryShowAd]);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
      <View style={styles.playerContainer}>
        {playMode === "youtube" ? (
          <YouTubeSongPlayer videoId={currentSong?.youtubeId} onEnded={handleNextSong} />
        ) : playMode === "spotify" && currentSong ? (
          <SpotifyPlayer
            spotifyUri={currentSong.spotifyUri}
            artist={currentSong.artist}
            title={currentSong.title}
            onSongChange={handleNextSong}
          />
        ) : playMode === "preview" && currentSong ? (
          <SpotifyPreviewPlayer spotifyUri={currentSong.spotifyUri} />
        ) : (
          <View
            style={[
              styles.playerPlaceholder,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}
      </View>

      <View
        style={[styles.infoCard, { backgroundColor: theme.backgroundDefault }]}
      >
        {isRevealed && currentSong ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.revealedInfo}>
            <ThemedText
              style={[styles.placementNumber, { color: theme.primary }]}
            >
              #{currentSong.placement}
            </ThemedText>
            <ThemedText style={styles.artistName}>
              {currentSong.artist}
            </ThemedText>
            <ThemedText style={styles.songTitle}>{currentSong.title}</ThemedText>
            <ThemedText style={[styles.yearText, { color: theme.textSecondary }]}>
              {currentSong.year}
            </ThemedText>
          </Animated.View>
        ) : (
          <View style={styles.hiddenInfo}>
            <ThemedText style={{ fontSize: 48, color: theme.textSecondary }}>?</ThemedText>
            <ThemedText
              style={[styles.guessText, { color: theme.textSecondary }]}
            >
              Can you guess this song?
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.buttonsContainer}>
        {!isRevealed && currentSong ? (
          <GameButton
            onPress={handleReveal}
            title="Reveal"
            variant="primary"
            disabled={!currentSong}
          />
        ) : null}
        <GameButton
          onPress={handleNextSong}
          title="Next Song"
          variant={isRevealed ? "primary" : "secondary"}
          disabled={!currentSong}
        />
      </View>
      <AdBanner />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  playerContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  startPlayingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    gap: Spacing.md,
  },
  playButtonLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  startPlayingText: {
    fontSize: 18,
    fontWeight: "600",
  },
  startPlayingSubtext: {
    fontSize: 14,
  },
  playerPlaceholder: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  spotifyContainer: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
  },
  spotifyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  spotifyMessage: {
    fontSize: 16,
    fontWeight: "500",
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  spotifySubtext: {
    fontSize: 14,
    textAlign: "center",
  },
  spotifyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  spotifyButtonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  spotifyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1DB954",
  },
  spotifyControls: {
    width: "100%",
    alignItems: "center",
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    width: "90%",
  },
  deviceSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  retryButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  deviceText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  deviceList: {
    marginTop: Spacing.sm,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    width: "90%",
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  deviceItemSelected: {
    backgroundColor: "rgba(29, 185, 84, 0.1)",
  },
  deviceItemText: {
    fontSize: 14,
    color: "#333",
  },
  deviceItemTextSelected: {
    color: "#1DB954",
    fontWeight: "600",
  },
  playButton: {
    width: 80,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  spotifyNowPlaying: {
    fontSize: 14,
    color: "#FFFFFF",
    opacity: 0.9,
  },
  infoCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 200,
  },
  loadingContainer: {
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
  },
  hiddenInfo: {
    alignItems: "center",
    gap: Spacing.lg,
  },
  guessText: {
    fontSize: 18,
    fontWeight: "500",
  },
  revealedInfo: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  placementNumber: {
    fontSize: 72,
    fontWeight: "700",
  },
  artistName: {
    fontSize: 18,
    fontWeight: "400",
    textAlign: "center",
  },
  songTitle: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
  },
  yearText: {
    fontSize: 16,
    fontWeight: "300",
    marginTop: Spacing.sm,
  },
  buttonsContainer: {
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  button: {
    height: 56,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
