import * as fs from "fs";
import * as path from "path";

type Song = {
  id: number;
  placement: number;
  artist: string;
  title: string;
  year: number;
  youtubeId: string;
  spotifyUri: string;
};

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(f => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
      if (char === "\r") i++;
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(f => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function extractYear(releaseDate: string): number {
  if (!releaseDate) return 2000;
  const match = releaseDate.match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : 2000;
}

function convertCsvToSongs(csvPath: string): Song[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  if (rows.length < 2) {
    console.log(`  Skipping ${csvPath}: not enough rows`);
    return [];
  }

  const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
  const dataRows = rows.slice(1);

  const getColIndex = (possibleNames: string[]): number => {
    for (const name of possibleNames) {
      const idx = headers.findIndex(h => h.includes(name));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const trackUriIdx = getColIndex(["track_uri", "spotify_uri", "uri"]);
  const trackNameIdx = getColIndex(["track_name", "title", "song", "name"]);
  const artistIdx = getColIndex(["artist_name", "artist", "artists"]);
  const releaseDateIdx = getColIndex(["release_date", "release", "date", "year"]);
  const youtubeIdIdx = getColIndex(["youtube_id", "youtubeid", "youtube"]);
  const noteringIdx = getColIndex(["notering", "placement", "rank", "position", "pos"]);

  const songs: Song[] = [];

  dataRows.forEach((row, index) => {
    if (row.length < 2) return;

    const spotifyUri = trackUriIdx >= 0 ? row[trackUriIdx] || "" : "";
    const title = trackNameIdx >= 0 ? row[trackNameIdx] || "" : "";
    const artist = artistIdx >= 0 ? row[artistIdx] || "" : "";
    const releaseDate = releaseDateIdx >= 0 ? row[releaseDateIdx] || "" : "";
    const youtubeId = youtubeIdIdx >= 0 ? row[youtubeIdIdx] || "" : "";
    
    let placement = index + 1;
    if (noteringIdx >= 0 && row[noteringIdx]) {
      const parsed = parseInt(row[noteringIdx], 10);
      if (!isNaN(parsed)) placement = parsed;
    }

    const year = extractYear(releaseDate);

    if (title && artist) {
      songs.push({
        id: index + 1,
        placement,
        artist: artist.replace(/;/g, ";"),
        title,
        year,
        youtubeId: youtubeId || "",
        spotifyUri: spotifyUri || "",
      });
    }
  });

  return songs;
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.csv$/i, "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();
}

function generateTsFile(songs: Song[], outputPath: string): void {
  const content = `import type { Song } from "../songs-data";

export const songs: Song[] = ${JSON.stringify(songs, null, 2)};
`;
  fs.writeFileSync(outputPath, content, "utf-8");
}

function main() {
  const hitsDir = path.join(__dirname, "../server/songcsv/hits");
  const outputDir = path.join(__dirname, "../shared/embedded-songs");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const csvFiles = fs.readdirSync(hitsDir).filter(f => f.endsWith(".csv"));
  
  const manifestEntries: { id: string; name: string; filename: string }[] = [];

  for (const csvFile of csvFiles) {
    const csvPath = path.join(hitsDir, csvFile);
    const sanitizedName = sanitizeFilename(csvFile);
    const outputPath = path.join(outputDir, `${sanitizedName}.ts`);

    console.log(`Converting: ${csvFile} -> ${sanitizedName}.ts`);
    
    const songs = convertCsvToSongs(csvPath);
    
    if (songs.length > 0) {
      generateTsFile(songs, outputPath);
      
      const displayName = csvFile
        .replace(/\.csv$/i, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      
      manifestEntries.push({
        id: sanitizedName,
        name: displayName,
        filename: sanitizedName,
      });
      
      console.log(`  -> ${songs.length} songs`);
    } else {
      console.log(`  -> Skipped (no valid songs)`);
    }
  }

  console.log("\n=== Manifest entries for index.ts ===\n");
  
  for (const entry of manifestEntries) {
    console.log(`import { songs as ${entry.id}_songs } from "./${entry.filename}";`);
  }
  
  console.log("\n// Add to songListManifest:\n");
  for (const entry of manifestEntries) {
    console.log(`  { id: "${entry.id}", name: "${entry.name}", songCount: ${entry.id}_songs.length },`);
  }
  
  console.log("\n// Add to songListsById:\n");
  for (const entry of manifestEntries) {
    console.log(`  "${entry.id}": ${entry.id}_songs,`);
  }

  console.log(`\nDone! Converted ${manifestEntries.length} CSV files.`);
}

main();
