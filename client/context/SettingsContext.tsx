import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type PlayMode = "youtube" | "spotify";

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
  selectedSongList: SelectedSongList;
  setSelectedSongList: (list: SelectedSongList) => void;
  songHistory: PlayedSong[];
  addToHistory: (song: { id: number; placement: number; artist: string; title: string; year: number }) => void;
  clearHistory: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [playMode, setPlayMode] = useState<PlayMode>("spotify");
  const [selectedSongList, setSelectedSongList] = useState<SelectedSongList>("top2000_top2025");
  const [songHistory, setSongHistory] = useState<PlayedSong[]>([]);

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

  return (
    <SettingsContext.Provider value={{ 
      playMode, 
      setPlayMode, 
      selectedSongList, 
      setSelectedSongList,
      songHistory,
      addToHistory,
      clearHistory,
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
