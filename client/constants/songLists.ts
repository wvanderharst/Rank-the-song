import { songListManifest, type SongListInfo } from "@shared/embedded-songs";

export type SongListOption = SongListInfo;

export const SONG_LISTS: SongListOption[] = songListManifest;

export const DEFAULT_SONG_LIST = "top2000_top2025";

export function getSongListById(id: string): SongListOption | undefined {
  return SONG_LISTS.find((list) => list.id === id);
}

export function getSongListName(id: string): string {
  const list = getSongListById(id);
  return list?.name || id;
}
