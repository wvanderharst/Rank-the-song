import type { Song } from "../songs-data";

import { songs as top2000_top2025_songs } from "./top2000_top2025";
import { songs as hits_Nederland_top_50_2025_songs } from "./hits_Nederland_top_50_2025";
import { songs as hits_Wereld_top_50_2025_songs } from "./hits_Wereld_top_50_2025";

export type SongListInfo = {
  id: string;
  name: string;
  songCount: number;
};

export const songListManifest: SongListInfo[] = [
  { id: "top2000_top2025", name: "Top 2000 (2025)", songCount: top2000_top2025_songs.length },
  { id: "hits_Nederland_top_50_2025", name: "Hits Nederland Top 50 (2025)", songCount: hits_Nederland_top_50_2025_songs.length },
  { id: "hits_Wereld_top_50_2025", name: "Hits Wereld Top 50 (2025)", songCount: hits_Wereld_top_50_2025_songs.length },
];

const songListsById: Record<string, Song[]> = {
  "top2000_top2025": top2000_top2025_songs,
  "hits_Nederland_top_50_2025": hits_Nederland_top_50_2025_songs,
  "hits_Wereld_top_50_2025": hits_Wereld_top_50_2025_songs,
};

export function getEmbeddedSongs(listId: string): Song[] {
  return songListsById[listId] || [];
}

export function getDefaultSongs(): Song[] {
  return getEmbeddedSongs("top2000_top2025");
}
