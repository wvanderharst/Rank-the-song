import { songListManifest, DEFAULT_SONG_LIST_ID, type SongListInfo } from "@shared/embedded-songs";

export type SongListOption = SongListInfo;

export const SONG_LISTS: SongListOption[] = songListManifest;

export const DEFAULT_SONG_LIST = DEFAULT_SONG_LIST_ID;

export function getSongListById(id: string): SongListOption | undefined {
  return SONG_LISTS.find((list) => list.id === id);
}

export function getSongListName(id: string): string {
  const list = getSongListById(id);
  return list?.name || id;
}
