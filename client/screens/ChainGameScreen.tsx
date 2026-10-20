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
import YoutubePlayer, { YoutubeIframeRef } from "react-native-youtube-iframe";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
  SlideInRight,
  SlideInLeft,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { YouTubePlayerWeb } from "@/components/YouTubePlayerWeb";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { useSettings, GameMode, OrderingMode, ChainDifficulty } from "@/context/SettingsContext";
import { useSpotifyAuth } from "@/context/SpotifyAuthContext";
import { Song } from "@shared/songs-data";
import { getRandomSong as getRandomSongFromList, getSongCount } from "@/lib/song-manager";
import { useAdManager } from "@/hooks/useAds";
import { AdBanner } from "@/components/AdBanner";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PLAYER_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const PLAYER_HEIGHT = (PLAYER_WIDTH * 9) / 16 * 0.6;

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

type ChainSong = Song & { revealed: boolean };

type TeamState = {
  id: number;
  name: string;
  chain: ChainSong[];
  score: number;
};

function GameButton({
  onPress,
  title,
  variant = "primary",
  disabled = false,
  small = false,
}: {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary" | "success" | "danger";
  disabled?: boolean;
  small?: boolean;
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

  const getColors = () => {
    switch (variant) {
      case "success":
        return { bg: "#22c55e", text: "#FFFFFF" };
      case "danger":
        return { bg: "#ef4444", text: "#FFFFFF" };
      case "secondary":
        return { bg: "transparent", text: theme.primary };
      default:
        return { bg: theme.primary, text: Colors.light.buttonText };
    }
  };

  const colors = getColors();

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[
          styles.button,
          small && styles.buttonSmall,
          { backgroundColor: colors.bg },
          variant === "secondary" && { borderWidth: 2, borderColor: theme.primary },
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
            small && styles.buttonTextSmall,
            { color: colors.text },
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

function CompactSpotifyPlayer({ spotifyUri }: { spotifyUri: string | null }) {
  const { theme } = useTheme();
  const { isAuthenticated, getValidAccessToken } = useSpotifyAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devicesFetched, setDevicesFetched] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const previousUri = useRef<string | null>(null);

  const getSpotifyTrackId = (uri: string | null): string | null => {
    if (!uri) return null;
    const match = uri.match(/spotify:track:([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const trackId = getSpotifyTrackId(spotifyUri);

  const fetchDevices = async () => {
    setError(null);
    setDevicesFetched(false);
    try {
      const token = await getValidAccessToken();
      if (!token) {
        setError("Connect Spotify in Settings");
        setDevicesFetched(true);
        return;
      }
      
      const response = await fetch("https://api.spotify.com/v1/me/player/devices", {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        setError("Could not connect to Spotify");
        setDevicesFetched(true);
        return;
      }
      
      const data = await response.json();
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
        setError("Connect Spotify in Settings");
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
          setError("No active device");
        } else {
          setError("Failed to play");
        }
      } else {
        setIsPlaying(true);
        setHasAutoPlayed(true);
      }
    } catch (err: any) {
      setError("Failed to play");
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
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated || !trackId) {
    return (
      <View style={[styles.compactPlayer, { backgroundColor: "#1DB954" }]}>
        <ThemedText style={styles.compactPlayerText}>
          {!isAuthenticated ? "Connect Spotify" : "No Spotify link"}
        </ThemedText>
      </View>
    );
  }

  if (!devicesFetched) {
    return (
      <View style={[styles.compactPlayer, { backgroundColor: "#1DB954" }]}>
        <ActivityIndicator size="small" color="#FFFFFF" />
      </View>
    );
  }

  if (error || devices.length === 0) {
    return (
      <View style={[styles.compactPlayer, { backgroundColor: "#1DB954" }]}>
        <ThemedText style={styles.compactPlayerText}>
          {error || "No devices"}
        </ThemedText>
        <Pressable style={styles.compactButton} onPress={fetchDevices}>
          <ThemedText style={styles.compactButtonText}>Retry</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.compactPlayer, { backgroundColor: "#1DB954" }]}>
      <Pressable
        style={styles.compactPlayButton}
        onPress={isPlaying ? handlePause : handlePlay}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#1DB954" />
        ) : (
          <ThemedText style={{ color: "#1DB954", fontSize: 14, fontWeight: "700" }}>
            {isPlaying ? "Pause" : "Play"}
          </ThemedText>
        )}
      </Pressable>
      <Pressable style={styles.compactButton} onPress={fetchDevices}>
        <ThemedText style={styles.compactButtonText}>Retry</ThemedText>
      </Pressable>
    </View>
  );
}

function ChainDisplay({ 
  chain, 
  currentSong,
  orderingMode,
  onInsertPosition,
  isSelectingPosition,
}: { 
  chain: ChainSong[];
  currentSong: Song | null;
  orderingMode: OrderingMode;
  onInsertPosition: (position: number) => void;
  isSelectingPosition: boolean;
}) {
  const { theme } = useTheme();

  const getValue = (song: Song | ChainSong) => {
    return orderingMode === "ranking" ? song.placement : song.year;
  };

  const getTopLabel = () => {
    return orderingMode === "ranking" ? "Better Ranking" : "Older";
  };

  const getBottomLabel = () => {
    return orderingMode === "ranking" ? "Worse Ranking" : "Newer";
  };

  if (chain.length === 0 && !isSelectingPosition) {
    return (
      <View style={[styles.chainContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText style={[styles.chainEmptyText, { color: theme.textSecondary }]}>
          Your chain will appear here
        </ThemedText>
        <ThemedText style={[styles.chainEmptySubtext, { color: theme.textSecondary }]}>
          Build a chain of 8 songs
        </ThemedText>
      </View>
    );
  }

  if (chain.length === 0 && isSelectingPosition) {
    return (
      <View style={[styles.chainContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Pressable
          style={[styles.insertSlotVertical, { borderColor: theme.primary, backgroundColor: theme.primary + "20" }]}
          onPress={() => onInsertPosition(0)}
        >
          <ThemedText style={[styles.insertSlotTextVertical, { color: theme.primary }]}>
            Place Here
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.chainContainer, { backgroundColor: theme.backgroundDefault }]}>
      <ThemedText style={[styles.chainDirectionLabel, { color: theme.textSecondary }]}>
        {getTopLabel()}
      </ThemedText>
      
      <ScrollView 
        style={styles.chainScrollVertical}
        contentContainerStyle={styles.chainContentVertical}
        showsVerticalScrollIndicator={false}
      >
        {chain.map((song, idx) => (
          <React.Fragment key={`chain-${song.id}-${idx}`}>
            {isSelectingPosition ? (
              <Pressable
                style={[styles.insertSlotVertical, { borderColor: theme.primary }]}
                onPress={() => onInsertPosition(idx)}
              >
                <ThemedText style={[styles.insertSlotTextVertical, { color: theme.primary }]}>
                  Place Here
                </ThemedText>
              </Pressable>
            ) : null}
            
            <View style={[styles.chainCardVertical, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[styles.chainValueVertical, { color: theme.primary }]}>
                {orderingMode === "ranking" ? `#${getValue(song)}` : getValue(song)}
              </ThemedText>
              <View style={styles.chainCardInfo}>
                <ThemedText style={styles.chainTitleVertical} numberOfLines={1}>
                  {song.title}
                </ThemedText>
                <ThemedText style={[styles.chainArtistVertical, { color: theme.textSecondary }]} numberOfLines={1}>
                  {song.artist}
                </ThemedText>
              </View>
            </View>
          </React.Fragment>
        ))}
        
        {isSelectingPosition ? (
          <Pressable
            style={[styles.insertSlotVertical, { borderColor: theme.primary }]}
            onPress={() => onInsertPosition(chain.length)}
          >
            <ThemedText style={[styles.insertSlotTextVertical, { color: theme.primary }]}>
              Place Here
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      <ThemedText style={[styles.chainDirectionLabel, { color: theme.textSecondary }]}>
        {getBottomLabel()}
      </ThemedText>
    </View>
  );
}

function TeamIndicator({ teams, currentTeam }: { teams: TeamState[]; currentTeam: number }) {
  const { theme } = useTheme();
  
  return (
    <View style={styles.teamIndicator}>
      {teams.map((team, idx) => (
        <View 
          key={team.id}
          style={[
            styles.teamBadge,
            { 
              backgroundColor: idx === currentTeam ? theme.primary : theme.backgroundDefault,
              borderColor: theme.primary,
            },
          ]}
        >
          <ThemedText 
            style={[
              styles.teamBadgeText,
              { color: idx === currentTeam ? "#FFFFFF" : theme.primary },
            ]}
          >
            {team.name}: {team.chain.length}/8
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

export default function ChainGameScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { playMode, gameMode, orderingMode, chainDifficulty, teamCount } = useSettings();
  const { onSongLoaded, tryShowAd } = useAdManager();
  const playerRef = useRef<YoutubeIframeRef>(null);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSelectingPosition, setIsSelectingPosition] = useState(false);
  const [usedSongIds, setUsedSongIds] = useState<Set<number>>(new Set());
  const [songsPlayed, setSongsPlayed] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [waitingForNextSong, setWaitingForNextSong] = useState(false);
  const [awaitingSecondChance, setAwaitingSecondChance] = useState(false);
  const [lastSelectedPosition, setLastSelectedPosition] = useState<number | null>(null);
  const [usedSecondChance, setUsedSecondChance] = useState(false);

  const initialTeams = useMemo(() => {
    if (gameMode === "team") {
      return Array.from({ length: teamCount }, (_, i) => ({
        id: i,
        name: `Team ${i + 1}`,
        chain: [] as ChainSong[],
        score: 0,
      }));
    }
    return [{ id: 0, name: "Player", chain: [] as ChainSong[], score: 0 }];
  }, [gameMode, teamCount]);

  const [teams, setTeams] = useState<TeamState[]>(initialTeams);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);

  useEffect(() => {
    setTeams(initialTeams);
    setCurrentTeamIndex(0);
    setGameOver(false);
    setWinner(null);
    setUsedSongIds(new Set());
    setSongsPlayed(0);
    setIsRevealed(false);
    setIsSelectingPosition(false);
    setCurrentSong(null);
    setWaitingForNextSong(false);
    setAwaitingSecondChance(false);
    setLastSelectedPosition(null);
    setUsedSecondChance(false);
  }, [gameMode, teamCount]);

  const currentTeam = teams[currentTeamIndex] || teams[0];

  const pickRandomSong = useCallback((): Song | null => {
    return getRandomSongFromList(usedSongIds);
  }, [usedSongIds]);

  useEffect(() => {
    if (!currentSong && teams.length > 0) {
      const initialSong = pickRandomSong();
      if (initialSong) {
        setCurrentSong(initialSong);
        setUsedSongIds(prev => new Set([...prev, initialSong.id]));
        setSongsPlayed(1);
        setIsSelectingPosition(true);
        onSongLoaded();
        tryShowAd();
      }
    }
  }, [currentSong, teams, onSongLoaded, tryShowAd]);

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const getValue = (song: Song) => {
    return orderingMode === "ranking" ? song.placement : song.year;
  };

  const checkCorrectPosition = (position: number): boolean => {
    if (!currentSong) return false;
    
    const chain = currentTeam.chain;
    const newValue = getValue(currentSong);
    
    if (chain.length === 0) return true;
    
    const prevSong = position > 0 ? chain[position - 1] : null;
    const nextSong = position < chain.length ? chain[position] : null;
    
    const prevValue = prevSong ? getValue(prevSong) : -Infinity;
    const nextValue = nextSong ? getValue(nextSong) : Infinity;
    
    if (orderingMode === "ranking") {
      return newValue > prevValue && newValue < nextValue;
    } else {
      return newValue >= prevValue && newValue <= nextValue;
    }
  };

  const addSongToChain = (position: number) => {
    if (!currentSong) return;
    
    const newChainSong: ChainSong = { ...currentSong, revealed: true };
    
    setTeams(prev => prev.map((team, idx) => {
      if (idx === currentTeamIndex) {
        const newChain = [...team.chain];
        newChain.splice(position, 0, newChainSong);
        
        newChain.sort((a, b) => {
          const aVal = orderingMode === "ranking" ? a.placement : a.year;
          const bVal = orderingMode === "ranking" ? b.placement : b.year;
          return aVal - bVal;
        });
        
        return { ...team, chain: newChain, score: team.score + 1 };
      }
      return team;
    }));

    const updatedChainLength = currentTeam.chain.length + 1;
    if (updatedChainLength >= 8) {
      setGameOver(true);
      setWinner(currentTeam.name);
      return true;
    }
    return false;
  };

  const handleInsertPosition = (position: number) => {
    if (!currentSong) return;

    const isCorrect = checkCorrectPosition(position);
    setLastSelectedPosition(position);
    
    if (isCorrect) {
      setIsRevealed(true);
      const gameEnded = addSongToChain(position);
      if (gameEnded) return;
      
      if (gameMode === "team") {
        setCurrentTeamIndex((prev) => (prev + 1) % teams.length);
      }
      setWaitingForNextSong(true);
    } else {
      if (chainDifficulty === "easy" && !usedSecondChance) {
        setAwaitingSecondChance(true);
        setIsSelectingPosition(false);
      } else {
        setIsRevealed(true);
        if (gameMode === "team") {
          setCurrentTeamIndex((prev) => (prev + 1) % teams.length);
        }
        setWaitingForNextSong(true);
      }
    }
  };

  const handleSecondChanceYes = () => {
    setAwaitingSecondChance(false);
    setUsedSecondChance(true);
    setIsSelectingPosition(true);
  };

  const handleSecondChanceNo = () => {
    setAwaitingSecondChance(false);
    setIsRevealed(true);
    if (gameMode === "team") {
      setCurrentTeamIndex((prev) => (prev + 1) % teams.length);
    }
    setWaitingForNextSong(true);
  };

  const handleNextSong = () => {
    setIsSelectingPosition(false);
    setIsRevealed(false);
    setWaitingForNextSong(false);
    setAwaitingSecondChance(false);
    setLastSelectedPosition(null);
    setUsedSecondChance(false);
    
    const newSong = pickRandomSong();
    if (newSong) {
      setCurrentSong(newSong);
      setUsedSongIds(prev => new Set([...prev, newSong.id]));
      setSongsPlayed(prev => prev + 1);
      setIsSelectingPosition(true);
      onSongLoaded();
      tryShowAd();
    }
  };

  const handleSkip = () => {
    if (gameMode === "team") {
      setCurrentTeamIndex((prev) => (prev + 1) % teams.length);
    }

    setIsSelectingPosition(false);
    setIsRevealed(false);
    setUsedSecondChance(false);
    
    const newSong = pickRandomSong();
    if (newSong) {
      setCurrentSong(newSong);
      setUsedSongIds(prev => new Set([...prev, newSong.id]));
      setSongsPlayed(prev => prev + 1);
      setIsSelectingPosition(true);
      onSongLoaded();
      tryShowAd();
    }
  };

  const handleRestart = () => {
    setTeams(initialTeams);
    setCurrentTeamIndex(0);
    setUsedSongIds(new Set());
    setSongsPlayed(0);
    setGameOver(false);
    setWinner(null);
    setIsRevealed(false);
    setIsSelectingPosition(false);
    setWaitingForNextSong(false);
    setAwaitingSecondChance(false);
    setLastSelectedPosition(null);
    setUsedSecondChance(false);
    
    const newSong = getRandomSongFromList();
    if (newSong) {
      setCurrentSong(newSong);
      setUsedSongIds(new Set([newSong.id]));
      setSongsPlayed(1);
      setIsSelectingPosition(true);
      onSongLoaded();
      tryShowAd();
    }
  };

  if (gameOver) {
    return (
      <ThemedView
        style={[
          styles.container,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
        <View style={styles.gameOverContainer}>
          <ThemedText style={[styles.gameOverTitle, { color: theme.primary }]}>
            Game Complete!
          </ThemedText>
          <ThemedText style={styles.gameOverWinner}>
            {winner} wins!
          </ThemedText>
          <ThemedText style={[styles.gameOverScore, { color: theme.textSecondary }]}>
            Completed in {songsPlayed} songs
          </ThemedText>
          <View style={styles.gameOverButtons}>
            <GameButton onPress={handleRestart} title="Play Again" variant="primary" />
          </View>
        </View>
        <AdBanner />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.md,
          },
        ]}
      >
      {gameMode === "team" ? (
        <TeamIndicator teams={teams} currentTeam={currentTeamIndex} />
      ) : null}

      <View style={styles.scoreRow}>
        <ThemedText style={[styles.scoreLabel, { color: theme.textSecondary }]}>
          {currentTeam.name}
        </ThemedText>
        <ThemedText style={[styles.scoreValue, { color: theme.primary }]}>
          {currentTeam.chain.length}/8
        </ThemedText>
        <View style={{ flex: 1 }} />
        <ThemedText style={[styles.scoreLabel, { color: theme.textSecondary }]}>
          Songs: {songsPlayed}
        </ThemedText>
      </View>

      <View style={styles.playerContainer}>
        {playMode === "youtube" && currentSong ? (
          <View style={styles.compactYoutube}>
            {Platform.OS === 'web' ? (
              <YouTubePlayerWeb
                videoId={currentSong.youtubeId}
                width={PLAYER_WIDTH}
                height={PLAYER_HEIGHT}
                play={true}
                mute={true}
              />
            ) : (
              <YoutubePlayer
                ref={playerRef}
                play={true}
                mute={true}
                height={PLAYER_HEIGHT}
                width={PLAYER_WIDTH}
                videoId={currentSong.youtubeId}
                initialPlayerParams={{
                  controls: true,
                  modestbranding: true,
                  rel: false,
                  preventFullScreen: true,
                  mute: true,
                }}
              />
            )}
          </View>
        ) : playMode === "spotify" && currentSong ? (
          <CompactSpotifyPlayer spotifyUri={currentSong.spotifyUri} />
        ) : (
          <View style={[styles.compactPlayer, { backgroundColor: theme.backgroundDefault }]}>
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
        )}
      </View>

      <View style={[styles.currentSongCard, { backgroundColor: theme.backgroundDefault }]}>
        {isRevealed && currentSong ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.revealedCompact}>
            <View style={styles.revealedRow}>
              <ThemedText style={[styles.revealedValue, { color: theme.primary }]}>
                {orderingMode === "ranking" ? `#${currentSong.placement}` : currentSong.year}
              </ThemedText>
              <View style={styles.revealedInfo}>
                <ThemedText style={styles.revealedTitle} numberOfLines={1}>
                  {currentSong.title}
                </ThemedText>
                <ThemedText style={[styles.revealedArtist, { color: theme.textSecondary }]} numberOfLines={1}>
                  {currentSong.artist}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ) : awaitingSecondChance && currentSong ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.secondChancePrompt}>
            <ThemedText style={[styles.secondChanceTitle, { color: theme.text }]}>
              Wrong position!
            </ThemedText>
            <View style={styles.secondChanceSongInfo}>
              <ThemedText style={styles.secondChanceSongTitle} numberOfLines={1}>
                {currentSong.title}
              </ThemedText>
              <ThemedText style={[styles.secondChanceSongArtist, { color: theme.textSecondary }]} numberOfLines={1}>
                {currentSong.artist}
              </ThemedText>
            </View>
            <ThemedText style={[styles.secondChanceQuestion, { color: theme.textSecondary }]}>
              Did you know this song? You get one more try.
            </ThemedText>
            <View style={styles.secondChanceButtons}>
              <Pressable
                style={[styles.secondChanceButton, { backgroundColor: "#22c55e" }]}
                onPress={handleSecondChanceYes}
              >
                <ThemedText style={styles.secondChanceButtonText}>Yes - Try Again</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.secondChanceButton, { backgroundColor: "#ef4444" }]}
                onPress={handleSecondChanceNo}
              >
                <ThemedText style={styles.secondChanceButtonText}>No - Next Song</ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.hiddenCompact}>
            <ThemedText style={[styles.guessText, { color: theme.text }]}>
              Where does this song belong?
            </ThemedText>
            <ThemedText style={[styles.guessSubtext, { color: theme.textSecondary }]}>
              Pick a position, then see if you're right
            </ThemedText>
          </View>
        )}
      </View>

      <ChainDisplay 
        chain={currentTeam.chain}
        currentSong={currentSong}
        orderingMode={orderingMode}
        onInsertPosition={handleInsertPosition}
        isSelectingPosition={isSelectingPosition && !isRevealed}
      />

      <View style={styles.buttonsContainer}>
        {waitingForNextSong ? (
          <GameButton
            onPress={handleNextSong}
            title="Next Song"
            variant="primary"
          />
        ) : !awaitingSecondChance ? (
          <GameButton
            onPress={handleSkip}
            title="Skip Song"
            variant="secondary"
            disabled={!currentSong || isRevealed}
          />
        ) : null}
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
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  scoreLabel: {
    fontSize: 14,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  playerContainer: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  compactYoutube: {
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  compactPlayer: {
    width: PLAYER_WIDTH,
    height: 60,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  compactPlayerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  compactPlayButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  compactButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  compactButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  currentSongCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    minHeight: 100,
    justifyContent: "center",
  },
  revealedCompact: {
    gap: Spacing.sm,
  },
  revealedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  revealedValue: {
    fontSize: 36,
    fontWeight: "700",
  },
  revealedInfo: {
    flex: 1,
  },
  revealedTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  revealedArtist: {
    fontSize: 14,
  },
  positionPrompt: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  hiddenCompact: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  guessText: {
    fontSize: 16,
    fontWeight: "600",
  },
  guessSubtext: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  chainContainer: {
    flex: 1,
    minHeight: 280,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  chainScrollVertical: {
    flex: 1,
  },
  chainContentVertical: {
    gap: Spacing.xs,
  },
  chainDirectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chainEmptyText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  chainEmptySubtext: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  chainCardVertical: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  chainValueVertical: {
    fontSize: 14,
    fontWeight: "700",
    minWidth: 50,
  },
  chainCardInfo: {
    flex: 1,
  },
  chainTitleVertical: {
    fontSize: 12,
    fontWeight: "500",
  },
  chainArtistVertical: {
    fontSize: 10,
  },
  insertSlotVertical: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  insertSlotTextVertical: {
    fontSize: 12,
    fontWeight: "600",
  },
  teamIndicator: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  teamBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  teamBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  buttonsContainer: {
    gap: Spacing.sm,
  },
  button: {
    height: 48,
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSmall: {
    height: 40,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextSmall: {
    fontSize: 14,
  },
  gameOverContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
  },
  gameOverTitle: {
    fontSize: 36,
    fontWeight: "700",
  },
  gameOverWinner: {
    fontSize: 24,
    fontWeight: "600",
  },
  gameOverScore: {
    fontSize: 18,
  },
  gameOverButtons: {
    marginTop: Spacing.xl,
    width: "100%",
  },
  secondChancePrompt: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  secondChanceTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  secondChanceSongInfo: {
    alignItems: "center",
    marginVertical: Spacing.xs,
  },
  secondChanceSongTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  secondChanceSongArtist: {
    fontSize: 14,
  },
  secondChanceQuestion: {
    fontSize: 13,
    textAlign: "center",
  },
  secondChanceButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  secondChanceButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  secondChanceButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
