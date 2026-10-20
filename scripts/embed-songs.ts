import * as fs from "fs";
import * as path from "path";

const SONG_CSV_DIR = path.join(process.cwd(), "server", "songcsv");
const OUTPUT_DIR = path.join(process.cwd(), "shared", "embedded-songs");
const MANIFEST_PATH = path.join(SONG_CSV_DIR, "manifest.json");

type SongListManifest = {
  songLists: { folder: string; files: string[] }[];
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}

function convertCSVToSongs(csvContent: string): any[] {
  const lines = csvContent.split("\n").filter(line => line.trim());
  
  if (lines.length < 2) {
    return [];
  }
  
  const header = parseCSVLine(lines[0]);
  const placementIdx = header.findIndex(h => h.toLowerCase() === "notering");
  const titleIdx = header.findIndex(h => h.toLowerCase().includes("track name"));
  const artistIdx = header.findIndex(h => h.toLowerCase().includes("artist"));
  const yearIdx = header.findIndex(h => h.toLowerCase() === "jaartal");
  const youtubeIdx = header.findIndex(h => h.toLowerCase().includes("youtube"));
  const spotifyIdx = header.findIndex(h => h.toLowerCase().includes("track uri") || h.toLowerCase().includes("spotify"));
  
  const songs: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    const placement = parseInt(values[placementIdx], 10);
    const title = values[titleIdx] || "";
    const artist = values[artistIdx] || "";
    const year = parseInt(values[yearIdx], 10);
    const youtubeId = values[youtubeIdx] || "";
    const spotifyUri = values[spotifyIdx] || null;
    
    if (!isNaN(placement) && title && artist && !isNaN(year)) {
      songs.push({
        id: i,
        placement,
        artist,
        title,
        year,
        youtubeId,
        spotifyUri,
      });
    }
  }
  
  return songs;
}

function sanitizeId(folder: string, file: string): string {
  const folderPart = folder.replace(/[^a-zA-Z0-9]/g, "_");
  const filePart = file.replace(/\.csv$/, "").replace(/[^a-zA-Z0-9]/g, "_");
  return `${folderPart}_${filePart}`;
}

function formatDisplayName(folder: string, file: string): string {
  const folderName = folder.charAt(0).toUpperCase() + folder.slice(1);
  const fileName = file.replace(/\.csv$/, "").replace(/[-_]/g, " ");
  return `${folderName} - ${fileName}`;
}

function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const manifest: SongListManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const embeddedLists: { id: string; name: string; moduleName: string; songCount: number }[] = [];
  
  for (const songList of manifest.songLists) {
    for (const file of songList.files) {
      const csvPath = path.join(SONG_CSV_DIR, songList.folder, file);
      
      if (!fs.existsSync(csvPath)) {
        console.warn(`CSV not found: ${csvPath}`);
        continue;
      }
      
      const csvContent = fs.readFileSync(csvPath, "utf-8");
      const songs = convertCSVToSongs(csvContent);
      
      const id = sanitizeId(songList.folder, file);
      const displayName = formatDisplayName(songList.folder, file);
      const moduleName = id;
      const outputPath = path.join(OUTPUT_DIR, `${moduleName}.ts`);
      
      const tsContent = `import type { Song } from "../songs-data";

export const songs: Song[] = ${JSON.stringify(songs, null, 2)};

export const metadata = {
  id: "${id}",
  name: "${displayName}",
  count: ${songs.length},
};
`;
      
      fs.writeFileSync(outputPath, tsContent);
      console.log(`Generated: ${moduleName}.ts (${songs.length} songs)`);
      
      embeddedLists.push({
        id,
        name: displayName,
        moduleName,
        songCount: songs.length,
      });
    }
  }
  
  const indexContent = `import type { Song } from "../songs-data";

${embeddedLists.map(m => `import { songs as ${m.moduleName}_songs, metadata as ${m.moduleName}_meta } from "./${m.moduleName}";`).join("\n")}

export type SongListInfo = {
  id: string;
  name: string;
  songCount: number;
};

export const songListManifest: SongListInfo[] = [
${embeddedLists.map(m => `  { id: "${m.id}", name: "${m.name}", songCount: ${m.songCount} },`).join("\n")}
];

const songListsById: Record<string, Song[]> = {
${embeddedLists.map(m => `  "${m.id}": ${m.moduleName}_songs,`).join("\n")}
};

export function getEmbeddedSongs(listId: string): Song[] {
  return songListsById[listId] || [];
}

export function getDefaultSongs(): Song[] {
  return getEmbeddedSongs("top2000_top2025");
}
`;
  
  fs.writeFileSync(path.join(OUTPUT_DIR, "index.ts"), indexContent);
  console.log("Generated: index.ts");
  console.log(`\nTotal: ${embeddedLists.length} song lists embedded`);
}

main();
