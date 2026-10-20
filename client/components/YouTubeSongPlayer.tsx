import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
} from "react-native";
import YoutubePlayer, { YoutubeIframeRef } from "react-native-youtube-iframe";

import { ThemedText } from "@/components/ThemedText";
import { YouTubePlayerWeb } from "@/components/YouTubePlayerWeb";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PLAYER_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
// YouTube requires embedded players of at least 200x200 px.
const PLAYER_HEIGHT = Math.max(200, (PLAYER_WIDTH * 9) / 16);

// How YouTube songs are played on a game screen: the player sits, full size and
// uncovered, at the bottom of the page (below everything else, so the video does
// not give the song away), while our own Play/Pause button at the top controls
// it. Nothing starts by itself, since the player is usually scrolled out of view
// (YouTube only allows autoplay of a visible player).
export function useYouTubeSong() {
  const [isPlaying, setIsPlaying] = useState(false);
  return { isPlaying, setIsPlaying };
}

type YouTubeSong = ReturnType<typeof useYouTubeSong>;

type PlayerProps = {
  videoId: string | undefined;
  song: YouTubeSong;
  onEnded?: () => void;
};

function SongPlayer({ videoId, song, onEnded }: PlayerProps) {
  const { theme } = useTheme();
  const playerRef = useRef<YoutubeIframeRef>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const { isPlaying, setIsPlaying } = song;

  const onPlayerReady = useCallback(() => {
    setIsPlayerReady(true);
  }, []);

  const onPlayerStateChange = useCallback((state: string) => {
    // Keep our Play/Pause button in sync with the player's own controls.
    if (state === "playing") setIsPlaying(true);
    if (state === "paused" || state === "ended") setIsPlaying(false);
    if (state === "ended") {
      onEnded?.();
    }
  }, [onEnded, setIsPlaying]);

  useEffect(() => {
    if (videoId && isPlayerReady && playerRef.current) {
      setTimeout(() => {
        playerRef.current?.seekTo(0, true);
      }, 300);
    }
  }, [videoId, isPlayerReady]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.playerWrapper}>
        <YouTubePlayerWeb
          videoId={videoId || ""}
          width={PLAYER_WIDTH}
          height={PLAYER_HEIGHT}
          play={isPlaying}
          mute={false}
          autoplay={false}
          onReady={onPlayerReady}
          onChangeState={onPlayerStateChange}
        />
        {!videoId ? (
          <View style={[styles.playerOverlay, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : null}
      </View>
    );
  }

  if (!videoId) {
    return (
      <View style={[styles.playerPlaceholder, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.playerWrapper}>
      <YoutubePlayer
        ref={playerRef}
        play={isPlaying}
        mute={false}
        onReady={onPlayerReady}
        onChangeState={onPlayerStateChange}
        height={PLAYER_HEIGHT}
        width={PLAYER_WIDTH}
        videoId={videoId}
        initialPlayerParams={{
          controls: true,
          modestbranding: true,
          rel: false,
          preventFullScreen: true,
          playerLang: "en",
          loop: false,
          mute: false,
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />
    </View>
  );
}

/**
 * Top of the game screen: our Play/Pause button for the YouTube player at the
 * bottom of the page (YouTubeBottomPlayer).
 */
export function YouTubePlayControls({ videoId, song }: Omit<PlayerProps, "onEnded">) {
  const { theme } = useTheme();
  const { isPlaying, setIsPlaying } = song;

  // Each new song waits for the Play button.
  useEffect(() => {
    setIsPlaying(false);
  }, [videoId, setIsPlaying]);

  // Some songs (e.g. new Top 2000 entries) have no YouTube video.
  if (videoId === "") {
    return (
      <View style={[styles.audioControls, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={[styles.audioHint, { color: theme.textSecondary }]}>
          Geen YouTube-video voor dit nummer. Kies een volgend nummer of speel via Spotify.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.audioControls, { backgroundColor: theme.backgroundDefault }]}>
      <Pressable
        style={[styles.playButton, { backgroundColor: theme.primary }]}
        onPress={() => setIsPlaying(!isPlaying)}
        disabled={!videoId}
      >
        <ThemedText style={styles.playButtonText}>
          {isPlaying ? "Pauze" : "Afspelen"}
        </ThemedText>
      </Pressable>
      <ThemedText style={[styles.scrollHint, { color: theme.text }]}>
        Voor kijkplezier: scroll naar beneden ↓
      </ThemedText>
      <ThemedText style={[styles.audioHint, { color: theme.textSecondary }]}>
        De YouTube-speler staat onderaan de pagina. Speelt er niets? Druk dan daar op play.
      </ThemedText>
    </View>
  );
}

/**
 * Bottom of the game screen: the YouTube player. Place it below everything
 * else on the page.
 */
export function YouTubeBottomPlayer({ videoId, song, onEnded }: PlayerProps) {
  const { theme } = useTheme();
  if (videoId === "") return null;

  return (
    <View style={styles.bottomSection}>
      <ThemedText style={[styles.bottomLabel, { color: theme.textSecondary }]}>
        Nu op YouTube
      </ThemedText>
      <SongPlayer videoId={videoId} song={song} onEnded={onEnded} />
    </View>
  );
}

const styles = StyleSheet.create({
  playerWrapper: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    position: "relative",
  },
  playerPlaceholder: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  playerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  audioControls: {
    width: PLAYER_WIDTH,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  playButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  scrollHint: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  audioHint: {
    fontSize: 13,
    textAlign: "center",
  },
  bottomSection: {
    alignItems: "center",
    width: "100%",
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  bottomLabel: {
    fontSize: 13,
  },
});
