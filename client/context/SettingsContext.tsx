import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type PlayMode = "youtube" | "spotify";

export type GameMode = "simple" | "singleplayer" | "team";

export type OrderingMode = "ranking" | "year";

export type ChainDifficulty = "easy" | "hard";

export type SelectedSongList = string | null;

export type PlayedSong = {
  id: number;
  placement: number;
  artist: string;
  title: string;
  year: number;
  playedAt: string;
};

interface SettingsContextType {
  playMode: PlayMode;
  setPlayMode: (mode: PlayMode) => void;
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  orderingMode: OrderingMode;
  setOrderingMode: (mode: OrderingMode) => void;
  chainDifficulty: ChainDifficulty;
  setChainDifficulty: (difficulty: ChainDifficulty) => void;
  teamCount: number;
  setTeamCount: (count: number) => void;
  selectedSongList: SelectedSongList;
  setSelectedSongList: (list: SelectedSongList) => void;
  songHistory: PlayedSong[];
  addToHistory: (song: { id: number; placement: number; artist: string; title: string; year: number }) => void;
  clearHistory: () => void;
  adsDisabled: boolean;
  setAdsDisabled: (disabled: boolean) => void;
  songsSinceLastAd: number;
  incrementSongCount: () => void;
  resetAdCounters: () => void;
  lastAdTimestamp: number;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [playMode, setPlayMode] = useState<PlayMode>("spotify");
  const [gameMode, setGameMode] = useState<GameMode>("simple");
  const [orderingMode, setOrderingMode] = useState<OrderingMode>("ranking");
  const [chainDifficulty, setChainDifficulty] = useState<ChainDifficulty>("hard");
  const [teamCount, setTeamCount] = useState<number>(2);
  const [selectedSongList, setSelectedSongList] = useState<SelectedSongList>("top2000_top2025");
  const [songHistory, setSongHistory] = useState<PlayedSong[]>([]);
  const [adsDisabled, setAdsDisabled] = useState<boolean>(false);
  const [songsSinceLastAd, setSongsSinceLastAd] = useState<number>(0);
  const [lastAdTimestamp, setLastAdTimestamp] = useState<number>(0);

  const addToHistory = useCallback((song: { id: number; placement: number; artist: string; title: string; year: number }) => {
    setSongHistory(prev => {
      const exists = prev.some(s => s.id === song.id && 
        new Date(s.playedAt).toDateString() === new Date().toDateString());
      if (exists) return prev;
      
      return [{
        ...song,
        playedAt: new Date().toISOString(),
      }, ...prev].slice(0, 100);
    });
  }, []);

  const clearHistory = useCallback(() => {
    setSongHistory([]);
  }, []);

  const incrementSongCount = useCallback(() => {
    setSongsSinceLastAd(prev => prev + 1);
  }, []);

  const resetAdCounters = useCallback(() => {
    setSongsSinceLastAd(0);
    setLastAdTimestamp(Date.now());
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      playMode, 
      setPlayMode,
      gameMode,
      setGameMode,
      orderingMode,
      setOrderingMode,
      chainDifficulty,
      setChainDifficulty,
      teamCount,
      setTeamCount,
      selectedSongList, 
      setSelectedSongList,
      songHistory,
      addToHistory,
      clearHistory,
      adsDisabled,
      setAdsDisabled,
      songsSinceLastAd,
      incrementSongCount,
      resetAdCounters,
      lastAdTimestamp,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
