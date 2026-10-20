import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useSettings, PlayMode, GameMode, OrderingMode, ChainDifficulty } from "@/context/SettingsContext";
import { useSpotifyAuth } from "@/context/SpotifyAuthContext";
import { getSongListName } from "@/constants/songLists";
import { useRemoveAdsPurchase } from "@/hooks/useAds";

type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, "Settings">;

function SongListSelector() {
  const { theme } = useTheme();
  const { selectedSongList } = useSettings();
  const navigation = useNavigation<SettingsNavigationProp>();

  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Song List</ThemedText>
      </View>
      <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
        Choose which song list to play from.
      </ThemedText>
      
      {selectedSongList ? (
        <View style={[styles.currentList, { borderColor: theme.primary }]}>
          <ThemedText style={[styles.currentListText, { color: theme.primary }]}>
            {getSongListName(selectedSongList)}
          </ThemedText>
        </View>
      ) : null}

      <Pressable
        style={[styles.selectListButton, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate("SongList")}
      >
        <ThemedText style={styles.selectListButtonText}>
          Change Song List
        </ThemedText>
      </Pressable>
    </View>
  );
}

function SongHistory() {
  const { theme } = useTheme();
  const { songHistory, clearHistory } = useSettings();
  const [sortByPlacement, setSortByPlacement] = useState(false);

  const sortedHistory = sortByPlacement 
    ? [...songHistory].sort((a, b) => a.placement - b.placement)
    : songHistory;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("nl-NL", { 
      day: "2-digit", 
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (songHistory.length === 0) {
    return (
      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>History</ThemedText>
        </View>
        <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
          No songs played yet. Start playing to see your history!
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>History</ThemedText>
        <View style={{ flex: 1 }} />
        <Pressable onPress={clearHistory}>
          <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>Clear</ThemedText>
        </Pressable>
      </View>

      <View style={styles.historySortRow}>
        <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
          Sort by placement
        </ThemedText>
        <Pressable
          style={[
            styles.historyToggle,
            { 
              backgroundColor: sortByPlacement ? theme.primary : theme.backgroundDefault,
              borderColor: theme.primary,
            },
          ]}
          onPress={() => setSortByPlacement(!sortByPlacement)}
        >
          {sortByPlacement ? (
            <ThemedText style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Y</ThemedText>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.historyList}>
        {sortedHistory.slice(0, 20).map((song, index) => (
          <View 
            key={`${song.id}-${song.playedAt}`} 
            style={[
              styles.historyItem,
              { borderColor: theme.textSecondary + "40" },
              index === 0 && { borderTopWidth: 0 }
            ]}
          >
            <View style={[styles.historyPlacement, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.historyPlacementText}>
                {song.placement}
              </ThemedText>
            </View>
            <View style={styles.historyInfo}>
              <ThemedText style={styles.historyTitle} numberOfLines={1}>
                {song.title}
              </ThemedText>
              <ThemedText style={[styles.historyArtist, { color: theme.textSecondary }]} numberOfLines={1}>
                {song.artist} ({song.year})
              </ThemedText>
            </View>
            <ThemedText style={[styles.historyDate, { color: theme.textSecondary }]}>
              {formatDate(song.playedAt)}
            </ThemedText>
          </View>
        ))}
      </View>

      {songHistory.length > 20 ? (
        <ThemedText style={[styles.sectionText, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }]}>
          Showing 20 of {songHistory.length} songs
        </ThemedText>
      ) : null}
    </View>
  );
}

function SpotifyLoginSection() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading, login, logout, fetchTokensFromServer } = useSpotifyAuth();

  return (
    <View
      style={[
        styles.section,
        { backgroundColor: theme.backgroundDefault },
      ]}
    >
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Spotify Account</ThemedText>
      </View>
      
      {isAuthenticated ? (
        <>
          <View style={styles.spotifyStatus}>
            <ThemedText style={[styles.sectionText, { color: "#1DB954" }]}>
              Connected to Spotify
            </ThemedText>
          </View>
          <Pressable
            style={[styles.spotifyButton, { borderColor: theme.textSecondary }]}
            onPress={logout}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <ThemedText style={[styles.spotifyButtonText, { color: theme.textSecondary }]}>
                Disconnect
              </ThemedText>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            Connect your Spotify account to control playback on your devices.
          </ThemedText>
          <View style={styles.spotifyButtonRow}>
            <Pressable
              style={[styles.spotifyButton, { backgroundColor: "#1DB954", borderColor: "#1DB954", flex: 1 }]}
              onPress={login}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={[styles.spotifyButtonText, { color: "#FFFFFF" }]}>
                  Connect Spotify
                </ThemedText>
              )}
            </Pressable>
          </View>
          {Platform.OS === "web" ? (
            <Pressable
              style={[styles.spotifyButton, { borderColor: theme.primary, marginTop: Spacing.sm }]}
              onPress={fetchTokensFromServer}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <ThemedText style={[styles.spotifyButtonText, { color: theme.primary }]}>
                  Refresh Connection
                </ThemedText>
              )}
            </Pressable>
          ) : null}
          {Platform.OS === "web" ? (
            <ThemedText style={[styles.sectionText, { color: theme.textSecondary, fontSize: 12, marginTop: Spacing.xs }]}>
              The app connects automatically after you log in. If it doesn't, tap "Refresh Connection".
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

function PlayModeToggle() {
  const { theme } = useTheme();
  const { playMode, setPlayMode } = useSettings();

  const options: { value: PlayMode; label: string }[] = [
    { value: "youtube", label: "YouTube" },
    { value: "spotify", label: "Spotify" },
  ];

  return (
    <View style={styles.toggleContainer}>
      {options.map((option) => {
        const isSelected = playMode === option.value;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.toggleOption,
              {
                backgroundColor: isSelected ? theme.primary : "transparent",
                borderColor: theme.primary,
              },
            ]}
            onPress={() => setPlayMode(option.value)}
          >
            <ThemedText
              style={[
                styles.toggleLabel,
                { color: isSelected ? "#FFFFFF" : theme.primary },
              ]}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function GameModeSection() {
  const { theme } = useTheme();
  const { gameMode, setGameMode, orderingMode, setOrderingMode, chainDifficulty, setChainDifficulty, teamCount, setTeamCount } = useSettings();

  const gameModes: { value: GameMode; label: string; description: string }[] = [
    { value: "simple", label: "Simple", description: "Play random songs and reveal" },
    { value: "singleplayer", label: "Single Player", description: "Build a chain of 8 songs in order" },
    { value: "team", label: "Team Mode", description: "Teams compete to build chains" },
  ];

  const orderingModes: { value: OrderingMode; label: string }[] = [
    { value: "ranking", label: "Ranking" },
    { value: "year", label: "Year" },
  ];

  const difficultyModes: { value: ChainDifficulty; label: string; description: string }[] = [
    { value: "easy", label: "Easy", description: "Second chances included" },
    { value: "hard", label: "Hard", description: "One guess per song" },
  ];

  const teamOptions = [2, 3, 4, 5, 6];

  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Game Mode</ThemedText>
      </View>
      
      <View style={styles.gameModeContainer}>
        {gameModes.map((mode) => {
          const isSelected = gameMode === mode.value;
          return (
            <Pressable
              key={mode.value}
              style={[
                styles.gameModeOption,
                {
                  backgroundColor: isSelected ? theme.primary : "transparent",
                  borderColor: theme.primary,
                },
              ]}
              onPress={() => setGameMode(mode.value)}
            >
              <ThemedText
                style={[
                  styles.gameModeLabel,
                  { color: isSelected ? "#FFFFFF" : theme.primary },
                ]}
              >
                {mode.label}
              </ThemedText>
              <ThemedText
                style={[
                  styles.gameModeDescription,
                  { color: isSelected ? "rgba(255,255,255,0.8)" : theme.textSecondary },
                ]}
                numberOfLines={1}
              >
                {mode.description}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {(gameMode === "singleplayer" || gameMode === "team") ? (
        <>
          <View style={styles.subsectionHeader}>
            <ThemedText style={[styles.subsectionTitle, { color: theme.textSecondary }]}>
              Order By
            </ThemedText>
          </View>
          <View style={styles.toggleContainer}>
            {orderingModes.map((mode) => {
              const isSelected = orderingMode === mode.value;
              return (
                <Pressable
                  key={mode.value}
                  style={[
                    styles.toggleOption,
                    {
                      backgroundColor: isSelected ? theme.primary : "transparent",
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => setOrderingMode(mode.value)}
                >
                  <ThemedText
                    style={[
                      styles.toggleLabel,
                      { color: isSelected ? "#FFFFFF" : theme.primary },
                    ]}
                  >
                    {mode.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {(gameMode === "singleplayer" || gameMode === "team") ? (
        <>
          <View style={styles.subsectionHeader}>
            <ThemedText style={[styles.subsectionTitle, { color: theme.textSecondary }]}>
              Difficulty
            </ThemedText>
          </View>
          <View style={styles.toggleContainer}>
            {difficultyModes.map((mode) => {
              const isSelected = chainDifficulty === mode.value;
              return (
                <Pressable
                  key={mode.value}
                  style={[
                    styles.difficultyOption,
                    {
                      backgroundColor: isSelected ? theme.primary : "transparent",
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => setChainDifficulty(mode.value)}
                >
                  <ThemedText
                    style={[
                      styles.difficultyLabel,
                      { color: isSelected ? "#FFFFFF" : theme.primary },
                    ]}
                  >
                    {mode.label}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.difficultyDescription,
                      { color: isSelected ? "rgba(255,255,255,0.8)" : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {mode.description}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {gameMode === "team" ? (
        <>
          <View style={styles.subsectionHeader}>
            <ThemedText style={[styles.subsectionTitle, { color: theme.textSecondary }]}>
              Number of Teams
            </ThemedText>
          </View>
          <View style={styles.teamCountContainer}>
            {teamOptions.map((count) => {
              const isSelected = teamCount === count;
              return (
                <Pressable
                  key={count}
                  style={[
                    styles.teamCountOption,
                    {
                      backgroundColor: isSelected ? theme.primary : "transparent",
                      borderColor: theme.primary,
                    },
                  ]}
                  onPress={() => setTeamCount(count)}
                >
                  <ThemedText
                    style={[
                      styles.teamCountLabel,
                      { color: isSelected ? "#FFFFFF" : theme.primary },
                    ]}
                  >
                    {count}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

function RemoveAdsSection() {
  const { theme } = useTheme();
  const { adsDisabled } = useSettings();
  const { purchaseRemoveAds, restorePurchases, isIAPAvailable } = useRemoveAdsPurchase();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handlePurchase = useCallback(async () => {
    setIsPurchasing(true);
    try {
      const success = await purchaseRemoveAds();
      if (!success) {
        Alert.alert("Purchase Failed", "Unable to complete the purchase. Please try again.");
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred during purchase.");
    } finally {
      setIsPurchasing(false);
    }
  }, [purchaseRemoveAds]);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert("Restored", "Your purchase has been restored. Ads are now disabled.");
      } else {
        Alert.alert("No Purchases Found", "No previous purchases were found to restore.");
      }
    } catch (error) {
      Alert.alert("Error", "An error occurred while restoring purchases.");
    } finally {
      setIsRestoring(false);
    }
  }, [restorePurchases]);

  if (Platform.OS === "web") {
    return null;
  }

  if (!isIAPAvailable) {
    return null;
  }

  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Remove Ads</ThemedText>
      </View>
      {adsDisabled ? (
        <ThemedText style={[styles.sectionText, { color: "#22c55e" }]}>
          Ads are disabled. Thank you for your support!
        </ThemedText>
      ) : (
        <>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            Remove all ads permanently with a one-time purchase.
          </ThemedText>
          <Pressable
            style={[styles.purchaseButton, { backgroundColor: theme.primary }]}
            onPress={handlePurchase}
            disabled={isPurchasing || isRestoring}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.purchaseButtonText}>
                Remove Ads
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            style={[styles.restoreButton, { borderColor: theme.textSecondary }]}
            onPress={handleRestore}
            disabled={isPurchasing || isRestoring}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={theme.textSecondary} />
            ) : (
              <ThemedText style={[styles.restoreButtonText, { color: theme.textSecondary }]}>
                Restore Purchase
              </ThemedText>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <GameModeSection />

        <RemoveAdsSection />

        <View
          style={[
            styles.section,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Play Mode</ThemedText>
          </View>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            Choose how you want to play songs. YouTube shows music videos, Spotify opens in a web player.
          </ThemedText>
          <PlayModeToggle />
        </View>

        <SpotifyLoginSection />

        <SongListSelector />

        <SongHistory />

        <View
          style={[
            styles.section,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>About</ThemedText>
          </View>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            Rank the Song is a game that tests your knowledge of the popularity of hits. Lists selected can be voted lists or popularity lists from a given year.
          </ThemedText>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            This game randomly selects songs from the list. Listen and try to guess the song before revealing its placement!
          </ThemedText>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            For Dutch players I suggest starting with the top2000 that is the default, for international players I suggest starting with the 10000 greastest hits list. These lists are also the most fun to play ranking based on year of release. 
          </ThemedText>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            The Youtube version has some issues, due to song choosing algorithm. The spotify version is more reliable. However the Youtube version ofcourse has the benefit of not needing a spotify account. However deleting ads from the app, will not disable ads in the Youtube player.
          </ThemedText>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>How to Play</ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>1</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              A random song from the selected list will be loaded
            </ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>2</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              Play the video and try to guess the song
            </ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>3</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              Press "Reveal" to see the placement, artist, and title
            </ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>4</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              Press "Next Song" to play another round
            </ThemedText>
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            Wouter van der Harst
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  section: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 22,
  },
  toggleContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  toggleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  gameModeContainer: {
    gap: Spacing.sm,
  },
  gameModeOption: {
    flexDirection: "column",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
  },
  gameModeLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  gameModeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  difficultyOption: {
    flex: 1,
    flexDirection: "column",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
  },
  difficultyLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  difficultyDescription: {
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
  subsectionHeader: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  teamCountContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  teamCountOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  teamCountLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FF6600",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 24,
    overflow: "hidden",
  },
  instructionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  footerText: {
    fontSize: 14,
  },
  spotifyStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  spotifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    marginTop: Spacing.md,
  },
  spotifyButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  spotifyButtonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  currentList: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  currentListText: {
    fontSize: 14,
    fontWeight: "500",
  },
  selectListButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  selectListButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  historySortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  historyToggle: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  historyList: {
    gap: 0,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  historyPlacement: {
    minWidth: 40,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
  },
  historyPlacementText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  historyArtist: {
    fontSize: 12,
  },
  historyDate: {
    fontSize: 11,
  },
  purchaseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  purchaseButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  restoreButtonText: {
    fontSize: 14,
  },
});
