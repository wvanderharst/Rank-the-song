import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { getRandomSong, getSongById, getAllSongs, setSongs, getSongCount } from "../shared/songs-data";
import { songListManifest, getEmbeddedSongs, getDefaultSongs } from "../shared/embedded-songs";
import { 
  getAvailableDevices, 
  playTrack, 
  pausePlayback, 
  resumePlayback, 
  getCurrentPlayback,
  getPlaybackState 
} from "./spotify";

const DEFAULT_SONG_LIST = "top2000_top2025";

function loadDefaultSongList(): void {
  const songs = getDefaultSongs();
  if (songs.length > 0) {
    setSongs(songs);
    console.log(`Loaded default song list (${DEFAULT_SONG_LIST}): ${songs.length} songs`);
  } else {
    console.warn(`Default song list is empty`);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  loadDefaultSongList();

  app.get("/api/songlists", (_req, res) => {
    res.json(songListManifest);
  });

  app.post("/api/songlists/import", async (req, res) => {
    try {
      const { listId } = req.body;
      
      if (!listId) {
        res.status(400).json({ error: "listId is required" });
        return;
      }
      
      const songs = getEmbeddedSongs(listId);
      
      if (songs.length === 0) {
        res.status(404).json({ error: "Song list not found" });
        return;
      }
      
      setSongs(songs);
      console.log(`Loaded song list (${listId}): ${songs.length} songs`);
      
      res.json({ success: true, songsLoaded: songs.length });
    } catch (error: any) {
      console.error("Error importing song list:", error);
      res.status(500).json({ error: error.message || "Failed to import song list" });
    }
  });

  app.get("/api/songs", (_req, res) => {
    res.json(getAllSongs());
  });

  app.get("/api/songs/random", (_req, res) => {
    res.json(getRandomSong());
  });

  app.get("/api/songs/count", (_req, res) => {
    res.json({ count: getSongCount() });
  });

  app.get("/api/songs/:id", (req, res) => {
    const id = parseInt(req.params.id, 10);
    const song = getSongById(id);
    
    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }
    
    res.json(song);
  });

  app.get("/api/spotify/devices", async (_req, res) => {
    try {
      const devices = await getAvailableDevices();
      res.json({ devices });
    } catch (error: any) {
      console.error("Failed to get Spotify devices:", error);
      res.status(500).json({ error: error.message || "Failed to get devices" });
    }
  });

  app.post("/api/spotify/play", async (req, res) => {
    try {
      const { spotifyUri, deviceId } = req.body;
      if (!spotifyUri) {
        res.status(400).json({ error: "spotifyUri is required" });
        return;
      }
      await playTrack(spotifyUri, deviceId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to play track:", error);
      res.status(500).json({ error: error.message || "Failed to play track" });
    }
  });

  app.post("/api/spotify/pause", async (req, res) => {
    try {
      const { deviceId } = req.body;
      await pausePlayback(deviceId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to pause playback:", error);
      res.status(500).json({ error: error.message || "Failed to pause" });
    }
  });

  app.post("/api/spotify/resume", async (req, res) => {
    try {
      const { deviceId } = req.body;
      await resumePlayback(deviceId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to resume playback:", error);
      res.status(500).json({ error: error.message || "Failed to resume" });
    }
  });

  app.get("/api/spotify/playback", async (_req, res) => {
    try {
      const playback = await getCurrentPlayback();
      res.json(playback || { is_playing: false });
    } catch (error: any) {
      console.error("Failed to get playback:", error);
      res.status(500).json({ error: error.message || "Failed to get playback" });
    }
  });

  app.get("/api/spotify/state", async (_req, res) => {
    try {
      const state = await getPlaybackState();
      res.json(state || { is_playing: false });
    } catch (error: any) {
      console.error("Failed to get playback state:", error);
      res.status(500).json({ error: error.message || "Failed to get state" });
    }
  });

  app.get("/oauth-callback", (_req, res) => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Spotify Connected</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1DB954 0%, #191414 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 40px;
      background: rgba(0,0,0,0.3);
      border-radius: 16px;
    }
    h1 { margin-bottom: 16px; }
    p { opacity: 0.8; margin-bottom: 24px; }
    .icon { font-size: 64px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    <h1>Spotify Connected!</h1>
    <p>You can close this window now.</p>
    <p><small>The app will automatically detect your login.</small></p>
  </div>
  <script>
    setTimeout(function() {
      window.close();
    }, 2000);
  </script>
</body>
</html>`;
    res.type('html').send(html);
  });

  const httpServer = createServer(app);

  return httpServer;
}
