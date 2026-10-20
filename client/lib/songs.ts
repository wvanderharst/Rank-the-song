import { getEmbeddedSongs, getDefaultSongs } from "@shared/embedded-songs";
import type { Song } from "@shared/songs-data";

/**
 * Picks a random song from the selected embedded song list.
 * Songs whose ids are in `avoidIds` are skipped while less than 70% of the
 * list has been played, so repeats only start once most songs have come up.
 */
export function pickRandomSong(listId: string | null, avoidIds: Set<number>): Song | null {
  const songs = listId ? getEmbeddedSongs(listId) : getDefaultSongs();
  if (songs.length === 0) {
    return null;
  }

  const shouldAvoidDuplicates = avoidIds.size < songs.length * 0.7;
  const candidates = shouldAvoidDuplicates
    ? songs.filter((song) => !avoidIds.has(song.id))
    : songs;
  const pool = candidates.length > 0 ? candidates : songs;

  return pool[Math.floor(Math.random() * pool.length)];
}
