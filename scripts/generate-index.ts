import * as fs from "fs";
import * as path from "path";

const embeddedDir = path.join(__dirname, "../shared/embedded-songs");

const files = fs.readdirSync(embeddedDir)
  .filter(f => f.endsWith(".ts") && f !== "index.ts")
  .sort();

function toVarName(filename: string): string {
  let name = filename.replace(".ts", "").replace(/[^a-zA-Z0-9_]/g, "_");
  if (/^[0-9]/.test(name)) {
    name = "list_" + name;
  }
  return name;
}

function toDisplayName(filename: string): string {
  const top2000 = filename.match(/^top2000_top(\d{4})\.ts$/);
  if (top2000) return `Top 2000 (${top2000[1]})`;
  return filename
    .replace(".ts", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

// The newest Top 2000 list is the default (scripts/update-top2000.ts adds one every year).
const defaultListId = files
  .filter(f => /^top2000_top\d{4}\.ts$/.test(f))
  .map(toVarName)
  .sort()
  .pop();

let imports = `import type { Song } from "../songs-data";\n\n`;
let manifestEntries: string[] = [];
let mapEntries: string[] = [];

for (const file of files) {
  const varName = toVarName(file);
  const importName = `${varName}_songs`;
  const displayName = toDisplayName(file);
  const id = varName;
  
  imports += `import { songs as ${importName} } from "./${file.replace(".ts", "")}";\n`;
  manifestEntries.push(`  { id: "${id}", name: "${displayName}", songCount: ${importName}.length }`);
  mapEntries.push(`  "${id}": ${importName}`);
}

const output = `${imports}
export type SongListInfo = {
  id: string;
  name: string;
  songCount: number;
};

export const songListManifest: SongListInfo[] = [
${manifestEntries.join(",\n")},
];

const songListsById: Record<string, Song[]> = {
${mapEntries.join(",\n")},
};

export function getEmbeddedSongs(listId: string): Song[] {
  return songListsById[listId] || [];
}

export const DEFAULT_SONG_LIST_ID = "${defaultListId}";

export function getDefaultSongs(): Song[] {
  return getEmbeddedSongs(DEFAULT_SONG_LIST_ID);
}
`;

const outputPath = path.join(embeddedDir, "index.ts");
fs.writeFileSync(outputPath, output, "utf-8");
console.log(`Generated ${outputPath} with ${files.length} song lists`);
