import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/context/SettingsContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { SONG_LISTS } from "@/constants/songLists";
import { setCurrentList } from "@/lib/song-manager";

export default function SongListScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { selectedSongList, setSelectedSongList } = useSettings();

  const handleSelectList = (listId: string) => {
<<<<<<< HEAD
    const success = setCurrentList(listId);
    if (success) {
      setSelectedSongList(listId);
      navigation.goBack();
    }
=======
    setSelectedSongList(listId);
    navigation.goBack();
>>>>>>> 1459cc205ec75c553597f6d7c5a21610b0c1052d
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
          Select a song list to play from. The selected list will be used for drawing random songs.
        </ThemedText>

        <View style={styles.listContainer}>
          {SONG_LISTS.map((list) => {
            const isSelected = selectedSongList === list.id;

            return (
              <Pressable
                key={list.id}
                style={[
                  styles.listRow,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: isSelected ? theme.primary : "transparent",
                  },
                ]}
                onPress={() => handleSelectList(list.id)}
              >
                <View style={styles.radioContainer}>
                  <View
                    style={[
                      styles.radioOuter,
                      {
                        borderColor: isSelected ? theme.primary : theme.textSecondary,
                      },
                    ]}
                  >
                    {isSelected ? (
                      <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />
                    ) : null}
                  </View>
                </View>

                <View style={styles.listInfo}>
                  <ThemedText
                    style={[
                      styles.listName,
                      { color: isSelected ? theme.primary : theme.text },
                    ]}
                  >
                    {list.name}
                  </ThemedText>
                  <ThemedText style={[styles.songCount, { color: theme.textSecondary }]}>
                    {list.songCount} songs
                  </ThemedText>
                </View>
<<<<<<< HEAD
=======

>>>>>>> 1459cc205ec75c553597f6d7c5a21610b0c1052d
              </Pressable>
            );
          })}
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
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 20,
  },
  listContainer: {
    gap: Spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.md,
  },
  radioContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  listInfo: {
    flex: 1,
  },
  listName: {
    fontSize: 16,
    fontWeight: "600",
  },
  songCount: {
    fontSize: 13,
    marginTop: 2,
  },
});
