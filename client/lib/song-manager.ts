import { Song } from "@shared/songs-data";
import { songListManifest, getEmbeddedSongs, getDefaultSongs } from "@shared/embedded-songs";

let currentSongs: Song[] = getDefaultSongs();
let currentListId: string = "top2000_top2025";

export function getSongLists() {
  return songListManifest;
}

export function setCurrentList(listId: string): boolean {
  const songs = getEmbeddedSongs(listId);
  if (songs.length === 0) return false;
  
  currentSongs = songs;
  currentListId = listId;
  return true;
}

export function getCurrentListId(): string {
  return currentListId;
}

export function getSongCount(): number {
  return currentSongs.length;
}

export function getRandomSong(excludeIds?: Set<number>): Song | null {
  if (currentSongs.length === 0) return null;
  
  if (excludeIds && excludeIds.size > 0) {
    const available = currentSongs.filter(s => !excludeIds.has(s.id));
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
  }
  
  return currentSongs[Math.floor(Math.random() * currentSongs.length)];
}

export function getSongById(id: number): Song | undefined {
  return currentSongs.find(s => s.id === id);
}
