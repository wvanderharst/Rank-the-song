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
  return filename
    .replace(".ts", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

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

export function getDefaultSongs(): Song[] {
  return getEmbeddedSongs("top2000_top2025");
}
`;

const outputPath = path.join(embeddedDir, "index.ts");
fs.writeFileSync(outputPath, output, "utf-8");
console.log(`Generated ${outputPath} with ${files.length} song lists`);
