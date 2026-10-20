export type Song = {
  id: number;
  placement: number;
  artist: string;
  title: string;
  year: number;
  youtubeId: string;
  spotifyUri: string | null;
};

let currentSongs: Song[] = [];

export function getRandomSong(): Song | null {
  if (currentSongs.length === 0) {
    return null;
  }
  return currentSongs[Math.floor(Math.random() * currentSongs.length)];
}

export function getSongById(id: number): Song | undefined {
  return currentSongs.find(song => song.id === id);
}

export function getAllSongs(): Song[] {
  return currentSongs;
}

export function getSongCount(): number {
  return currentSongs.length;
}

export function setSongs(songs: Song[]): void {
  currentSongs = songs;
}
