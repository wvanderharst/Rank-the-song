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

// How YouTube songs are played on a game screen:
// - Video: the player sits at the top, visible, and starts each song muted.
// - Audio: the player sits, full size and uncovered, at the bottom of the page
//   (below everything else), while our own Play/Pause button at the top
//   controls it. Nothing starts by itself in this mode, since the player is
//   usually scrolled out of view (YouTube only allows autoplay of a visible player).
export function useYouTubeSong() {
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  return { isAudioOnly, setIsAudioOnly, isPlaying, setIsPlaying };
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
  const { isAudioOnly, isPlaying, setIsPlaying } = song;

  const onPlayerReady = useCallback(() => {
    setIsPlayerReady(true);
  }, []);

  const onPlayerStateChange = useCallback((state: string) => {
    // In audio mode, keep our Play/Pause button in sync with the player's own controls.
    if (isAudioOnly) {
      if (state === "playing") setIsPlaying(true);
      if (state === "paused" || state === "ended") setIsPlaying(false);
    }
    if (state === "ended") {
      onEnded?.();
    }
  }, [isAudioOnly, onEnded, setIsPlaying]);

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
          play={isAudioOnly ? isPlaying : true}
          mute={!isAudioOnly}
          autoplay={!isAudioOnly}
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
        play={isAudioOnly ? isPlaying : true}
        mute={!isAudioOnly}
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
          mute: !isAudioOnly,
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
 * Top of the game screen: the Video/Audio switch, then the video player, or in
 * audio mode our Play/Pause button for the player at the bottom of the page.
 */
export function YouTubeSongPlayer({ videoId, song, onEnded }: PlayerProps) {
  const { theme } = useTheme();
  const { isAudioOnly, setIsAudioOnly, isPlaying, setIsPlaying } = song;

  // Each new song waits for the Play button in audio mode.
  useEffect(() => {
    setIsPlaying(false);
  }, [videoId, isAudioOnly, setIsPlaying]);

  return (
    <View style={styles.youtubeSection}>
      <View style={styles.videoAudioToggle}>
        <Pressable
          style={[
            styles.toggleOption,
            {
              backgroundColor: !isAudioOnly ? theme.primary : "transparent",
              borderColor: theme.primary,
            },
          ]}
          onPress={() => setIsAudioOnly(false)}
        >
          <ThemedText
            style={[
              styles.toggleLabel,
              { color: !isAudioOnly ? "#FFFFFF" : theme.primary },
            ]}
          >
            Video
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.toggleOption,
            {
              backgroundColor: isAudioOnly ? theme.primary : "transparent",
              borderColor: theme.primary,
            },
          ]}
          onPress={() => setIsAudioOnly(true)}
        >
          <ThemedText
            style={[
              styles.toggleLabel,
              { color: isAudioOnly ? "#FFFFFF" : theme.primary },
            ]}
          >
            Audio
          </ThemedText>
        </Pressable>
      </View>
      {isAudioOnly ? (
        <View style={[styles.audioControls, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable
            style={[styles.playButton, { backgroundColor: theme.primary }]}
            onPress={() => setIsPlaying(!isPlaying)}
            disabled={!videoId}
          >
            <ThemedText style={styles.playButtonText}>
              {isPlaying ? "Pause" : "Play"}
            </ThemedText>
          </Pressable>
          <ThemedText style={[styles.audioHint, { color: theme.textSecondary }]}>
            The YouTube player is at the bottom of the page. If nothing plays, press play there.
          </ThemedText>
        </View>
      ) : (
        <SongPlayer videoId={videoId} song={song} onEnded={onEnded} />
      )}
    </View>
  );
}

/**
 * Bottom of the game screen: the YouTube player in audio mode. Place it below
 * everything else on the page. Renders nothing in video mode.
 */
export function YouTubeAudioModePlayer({ videoId, song, onEnded }: PlayerProps) {
  const { theme } = useTheme();
  if (!song.isAudioOnly) return null;

  return (
    <View style={styles.bottomSection}>
      <ThemedText style={[styles.bottomLabel, { color: theme.textSecondary }]}>
        Now playing on YouTube
      </ThemedText>
      <SongPlayer videoId={videoId} song={song} onEnded={onEnded} />
    </View>
  );
}

const styles = StyleSheet.create({
  youtubeSection: {
    alignItems: "center",
    width: "100%",
  },
  videoAudioToggle: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  toggleOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
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
    fontSize: 20,
    fontWeight: "700",
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
