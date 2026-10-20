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
        <ThemedText style={styles.sectionTitle}>Nummerlijst</ThemedText>
      </View>
      <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
        Kies met welke nummerlijst je speelt.
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
          Andere lijst kiezen
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
          <ThemedText style={styles.sectionTitle}>Geschiedenis</ThemedText>
        </View>
        <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
          Nog geen nummers gespeeld. Begin met spelen om je geschiedenis te zien!
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Geschiedenis</ThemedText>
        <View style={{ flex: 1 }} />
        <Pressable onPress={clearHistory}>
          <ThemedText style={{ color: theme.textSecondary, fontSize: 14 }}>Wissen</ThemedText>
        </Pressable>
      </View>

      <View style={styles.historySortRow}>
        <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
          Sorteer op notering
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
          20 van {songHistory.length} nummers getoond
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
        <ThemedText style={styles.sectionTitle}>Spotify-account</ThemedText>
      </View>
      
      {isAuthenticated ? (
        <>
          <View style={styles.spotifyStatus}>
            <ThemedText style={[styles.sectionText, { color: "#1DB954" }]}>
              Gekoppeld aan Spotify
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
                Ontkoppelen
              </ThemedText>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            Koppel je Spotify-account om het afspelen op je apparaten te bedienen.
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
                  Spotify koppelen
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
                  Verbinding vernieuwen
                </ThemedText>
              )}
            </Pressable>
          ) : null}
          {Platform.OS === "web" ? (
            <ThemedText style={[styles.sectionText, { color: theme.textSecondary, fontSize: 12, marginTop: Spacing.xs }]}>
              {"De app maakt automatisch verbinding nadat je bent ingelogd. Lukt dat niet, tik dan op “Verbinding vernieuwen”."}
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
    // Website: Spotify's preview player (no login). App: Spotify login + playback control.
    Platform.OS === "web"
      ? { value: "preview", label: "Spotify" }
      : { value: "spotify", label: "Spotify" },
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
    { value: "simple", label: "Simpel", description: "Speel willekeurige nummers en onthul ze" },
    { value: "singleplayer", label: "Eén speler", description: "Zo lang mogelijk, tot je eerste fout" },
    { value: "team", label: "Teams", description: "Om de beurt, bij een fout ben je af" },
  ];

  const orderingModes: { value: OrderingMode; label: string }[] = [
    { value: "ranking", label: "Notering" },
    { value: "year", label: "Jaar" },
  ];

  const difficultyModes: { value: ChainDifficulty; label: string; description: string }[] = [
    { value: "easy", label: "Makkelijk", description: "Met tweede kansen" },
    { value: "hard", label: "Moeilijk", description: "Eén poging per nummer" },
  ];

  const teamOptions = [2, 3, 4, 5, 6];

  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Spelmodus</ThemedText>
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
              Sorteren op
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
              Moeilijkheid
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
              Aantal teams
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
        Alert.alert("Aankoop mislukt", "De aankoop kon niet worden voltooid. Probeer het opnieuw.");
      }
    } catch (error) {
      Alert.alert("Fout", "Er ging iets mis tijdens de aankoop.");
    } finally {
      setIsPurchasing(false);
    }
  }, [purchaseRemoveAds]);

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        Alert.alert("Hersteld", "Je aankoop is hersteld. Advertenties staan nu uit.");
      } else {
        Alert.alert("Geen aankopen gevonden", "Er zijn geen eerdere aankopen gevonden om te herstellen.");
      }
    } catch (error) {
      Alert.alert("Fout", "Er ging iets mis bij het herstellen van aankopen.");
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
        <ThemedText style={styles.sectionTitle}>Advertenties verwijderen</ThemedText>
      </View>
      {adsDisabled ? (
        <ThemedText style={[styles.sectionText, { color: "#22c55e" }]}>
          Advertenties staan uit. Bedankt voor je steun!
        </ThemedText>
      ) : (
        <>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            Verwijder alle advertenties voorgoed met een eenmalige aankoop.
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
                Advertenties verwijderen
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
                Aankoop herstellen
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
            <ThemedText style={styles.sectionTitle}>Afspeelmodus</ThemedText>
          </View>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            {Platform.OS === "web"
              ? "Kies hoe je nummers afspeelt. YouTube speelt het hele nummer, Spotify speelt een fragment van 30 seconden (zonder inloggen)."
              : "Kies hoe je nummers afspeelt. YouTube speelt het hele nummer, Spotify opent in een webspeler."}
          </ThemedText>
          <PlayModeToggle />
        </View>

        {Platform.OS !== "web" ? <SpotifyLoginSection /> : null}

        <SongListSelector />

        <SongHistory />

        <View
          style={[
            styles.section,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Over</ThemedText>
          </View>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary }]}>
            Rank the Song is een spel dat test hoe goed je de populariteit van hits kent. De lijsten zijn stemlijsten of hitlijsten van een bepaald jaar.
          </ThemedText>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            Het spel kiest willekeurig nummers uit de lijst. Luister en probeer het nummer te raden voordat je de notering onthult!
          </ThemedText>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            Voor Nederlandse spelers raad ik aan te beginnen met de Top 2000, die standaard is ingesteld. Internationale spelers kunnen het best beginnen met de lijst met de 10.000 grootste hits. Met deze lijsten is het ook het leukst om op jaar van uitkomen te sorteren.
          </ThemedText>
          <ThemedText style={[styles.sectionText, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            De YouTube-versie heeft soms problemen door de manier waarop video’s worden gekozen. De Spotify-versie is betrouwbaarder. De YouTube-versie heeft natuurlijk wel als voordeel dat je geen Spotify-account nodig hebt. Let op: als je de advertenties in de app verwijdert, blijven de advertenties in de YouTube-speler gewoon zichtbaar.
          </ThemedText>
        </View>

        <View
          style={[
            styles.section,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Zo speel je</ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>1</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              Er wordt een willekeurig nummer uit de gekozen lijst geladen
            </ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>2</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              Speel het nummer af en probeer het te raden
            </ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>3</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              Druk op “Onthullen” om de notering, artiest en titel te zien
            </ThemedText>
          </View>
          <View style={styles.instructionItem}>
            <ThemedText style={styles.instructionNumber}>4</ThemedText>
            <ThemedText style={[styles.instructionText, { color: theme.textSecondary }]}>
              Druk op “Volgende nummer” voor een nieuwe ronde
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
