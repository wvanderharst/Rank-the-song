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
const PLAYER_HEIGHT = (PLAYER_WIDTH * 9) / 16;

/**
 * YouTube player used by the game screens, with a Video/Audio switch so the
 * video (which often shows the title) can be hidden.
 */
export function YouTubeSongPlayer({
  videoId,
  onEnded,
}: {
  videoId: string | undefined;
  onEnded?: () => void;
}) {
  const { theme } = useTheme();
  const playerRef = useRef<YoutubeIframeRef>(null);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  const onPlayerReady = useCallback(() => {
    setIsPlayerReady(true);
  }, []);

  const onPlayerStateChange = useCallback((state: string) => {
    if (state === "ended") {
      onEnded?.();
    }
  }, [onEnded]);

  useEffect(() => {
    if (videoId && isPlayerReady && playerRef.current) {
      setTimeout(() => {
        playerRef.current?.seekTo(0, true);
      }, 300);
    }
  }, [videoId, isPlayerReady]);

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
      <View style={[styles.playerWrapper, isAudioOnly && styles.playerHidden]}>
        {Platform.OS === 'web' ? (
          <YouTubePlayerWeb
            videoId={videoId || ''}
            width={isAudioOnly ? 1 : PLAYER_WIDTH}
            height={isAudioOnly ? 1 : PLAYER_HEIGHT}
            play={true}
            mute={true}
            onReady={onPlayerReady}
            onChangeState={onPlayerStateChange}
          />
        ) : videoId ? (
          <YoutubePlayer
            ref={playerRef}
            play={true}
            mute={true}
            onReady={onPlayerReady}
            onChangeState={onPlayerStateChange}
            height={isAudioOnly ? 1 : PLAYER_HEIGHT}
            width={isAudioOnly ? 1 : PLAYER_WIDTH}
            videoId={videoId}
            initialPlayerParams={{
              controls: true,
              modestbranding: true,
              rel: false,
              preventFullScreen: true,
              playerLang: "en",
              loop: false,
              mute: true,
            }}
            webViewProps={{
              allowsInlineMediaPlayback: true,
              mediaPlaybackRequiresUserAction: false,
            }}
          />
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
        {!videoId && Platform.OS === 'web' ? (
          <View style={[styles.playerOverlay, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : null}
      </View>
      {isAudioOnly ? (
        <View style={[styles.audioOnlyIndicator, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.muteButton, { backgroundColor: theme.primary }]}>
            <ThemedText style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "700" }}>
              Audio
            </ThemedText>
          </View>
          <ThemedText style={[styles.audioOnlyText, { color: theme.textSecondary }]}>
            Audio playing (muted for autoplay)
          </ThemedText>
        </View>
      ) : null}
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
  playerHidden: {
    height: 1,
    width: 1,
    opacity: 0,
    position: "absolute",
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
  audioOnlyIndicator: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  muteButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  audioOnlyText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
