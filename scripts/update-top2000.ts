// Yearly Top 2000 update, run by .github/workflows/update-top2000.yml.
//
// 1. Finds the new NPO Radio 2 Top 2000 list for YEAR (default: this year).
// 2. Reuses the YouTube id, Spotify URI and year of songs we already have in
//    any embedded song list (shared/embedded-songs).
// 3. Looks up the remaining songs on Spotify and YouTube. YouTube searches cost
//    API quota, so at most YOUTUBE_SEARCH_LIMIT per run; unfinished work is
//    kept in server/songcsv/top2000/top<YEAR>.pending.json and continued on the
//    next run.
// 4. When every song has been looked up, writes
//    shared/embedded-songs/top2000_top<YEAR>.ts and regenerates the index, which
//    makes it the default list.
//
// Environment:
//   YEAR                       edition to fetch (default: current year)
//   SOURCE_URL                 optional URL or file path of the list (.xlsx, .csv or .json),
//                              for when the list cannot be found automatically
//   SPOTIFY_CLIENT_ID/SECRET   optional, for Spotify lookups
//   YOUTUBE_API_KEY            optional, for YouTube lookups (YouTube Data API v3)
//   YOUTUBE_SEARCH_LIMIT       YouTube searches per run (default 90; 100 quota units each)
//   FAIL_IF_NOT_FOUND          "true": exit with an error when the list is not published yet
//   DRY_RUN                    "true": only find the list and try a few lookups; write nothing

import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

type ListEntry = { placement: number; artist: string; title: string; year: number | null };

type PendingSong = ListEntry & {
  youtubeId: string | null;
  spotifyUri: string | null;
  youtubeSearched: boolean;
  spotifySearched: boolean;
};

type Song = {
  id: number;
  placement: number;
  artist: string;
  title: string;
  year: number;
  youtubeId: string;
  spotifyUri: string | null;
};

const ROOT = path.join(__dirname, "..");
const EMBEDDED_DIR = path.join(ROOT, "shared", "embedded-songs");
const PENDING_DIR = path.join(ROOT, "server", "songcsv", "top2000");

const YEAR = parseInt(process.env.YEAR || String(new Date().getFullYear()), 10);
const OUTPUT_FILE = path.join(EMBEDDED_DIR, `top2000_top${YEAR}.ts`);
const PENDING_FILE = path.join(PENDING_DIR, `top${YEAR}.pending.json`);
const DRY_RUN = process.env.DRY_RUN === "true";
// A dry run tries only a few lookups, to check the API keys.
const YOUTUBE_SEARCH_LIMIT = DRY_RUN ? 2 : parseInt(process.env.YOUTUBE_SEARCH_LIMIT || "90", 10);
const SPOTIFY_SEARCH_LIMIT = DRY_RUN ? 5 : Infinity;

const NPO_PAGES = [
  "https://www.nporadio2.nl/top2000",
  "https://www.nporadio2.nl/nieuws/top2000",
];
const NPO_CHART_PAGE = "https://www.nporadio2.nl/charts/top-2000";
const USER_AGENT = "Mozilla/5.0 (compatible; RankTheSongBot/1.0; +https://github.com/wvanderharst/Rank-the-song)";

const summary: string[] = [];
function report(line: string) {
  console.log(line);
  summary.push(line);
}

function setOutput(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

function writeSummary() {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Top 2000 ${YEAR}\n\n${summary.join("\n\n")}\n`);
  }
}

/* -------------------- Matching -------------------- */

// Song list files look like `export const songs: Song[] = [ ...JSON... ];`.
function readSongFile(file: string): Song[] {
  const source = fs.readFileSync(file, "utf8");
  return JSON.parse(source.slice(source.indexOf("= [") + 2, source.lastIndexOf("]") + 1));
}

function normalize(text: string, dropBrackets = false): string {
  let s = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (dropBrackets) s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
  return s
    .replace(/\s(feat\.?|ft\.?|featuring)\s.*$/, " ")
    .replace(/&/g, " and ")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function songKey(artist: string, title: string, dropBrackets = false): string {
  return `${normalize(artist, dropBrackets)}|${normalize(title, dropBrackets)}`;
}

type Known = { youtubeId: string; spotifyUri: string | null; year: number };

// Lookup of songs we already have, newest Top 2000 lists first so their data wins.
function loadKnownSongs(): Map<string, Known> {
  const files = fs.readdirSync(EMBEDDED_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .sort((a, b) => {
      const top = (f: string) => (f.startsWith("top2000_top") ? 0 : 1);
      return top(a) - top(b) || b.localeCompare(a);
    });

  const known = new Map<string, Known>();
  for (const file of files) {
    let songs: Song[];
    try {
      songs = readSongFile(path.join(EMBEDDED_DIR, file));
    } catch {
      console.log(`Skipping ${file}: not plain JSON`);
      continue;
    }
    for (const song of songs) {
      if (!song.youtubeId && !song.spotifyUri) continue;
      const value = { youtubeId: song.youtubeId, spotifyUri: song.spotifyUri || null, year: song.year };
      for (const key of [songKey(song.artist, song.title), songKey(song.artist, song.title, true)]) {
        if (!known.has(key)) known.set(key, value);
      }
    }
  }
  return known;
}

/* -------------------- Finding the list -------------------- */

async function fetchBuffer(url: string): Promise<Buffer> {
  if (!/^https?:\/\//.test(url)) return fs.readFileSync(url);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchText(url: string): Promise<string> {
  return (await fetchBuffer(url)).toString("utf8");
}

const HEADER_PATTERNS = {
  placement: /^(positie|pos|nr|no|nummer|notering|rank|ranking|position|plaats)$/,
  title: /^(titel|title|track|song|naam|name|tracktitle)$/,
  artist: /^(artiest|artist|artiesten|artists|artistname|uitvoerende)$/,
  year: /^(jaar|year|releaseyear|jaartal)$/,
};

function headerName(cell: string): string {
  return cell.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
}

// Turns spreadsheet rows (header row somewhere near the top) into list entries.
function entriesFromRows(rows: string[][]): ListEntry[] {
  const headerIndex = rows.slice(0, 20).findIndex((row) => {
    const names = row.map(headerName);
    return names.some((n) => HEADER_PATTERNS.title.test(n)) && names.some((n) => HEADER_PATTERNS.artist.test(n));
  });
  if (headerIndex < 0) throw new Error("No header row with title and artist columns found");

  const names = rows[headerIndex].map(headerName);
  const column = (pattern: RegExp) => names.findIndex((n) => pattern.test(n));
  const placementCol = column(HEADER_PATTERNS.placement);
  const titleCol = column(HEADER_PATTERNS.title);
  const artistCol = column(HEADER_PATTERNS.artist);
  const yearCol = column(HEADER_PATTERNS.year);

  const entries: ListEntry[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const title = (row[titleCol] || "").trim();
    const artist = (row[artistCol] || "").trim();
    if (!title || !artist) continue;
    const placement = placementCol >= 0 ? parseInt(row[placementCol], 10) : entries.length + 1;
    const year = yearCol >= 0 ? parseInt(row[yearCol], 10) : NaN;
    if (Number.isNaN(placement)) continue;
    entries.push({ placement, artist, title, year: Number.isNaN(year) ? null : year });
  }
  return entries;
}

function parseCsv(content: string): string[][] {
  // Excel exports often start with a title line, so look at the first lines together.
  const head = content.split(/\r?\n/, 10).join("\n");
  const delimiter = (head.match(/;/g) || []).length > (head.match(/,/g) || []).length ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (inQuotes) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

async function parseXlsx(buffer: Buffer): Promise<string[][]> {
  // Installed by the workflow only (npm install --no-save exceljs).
  const moduleName = "exceljs";
  const ExcelJS: any = await import(moduleName);
  const workbook = new (ExcelJS.default ?? ExcelJS).Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row: any) => {
    const values: unknown[] = row.values.slice(1);
    rows.push(values.map((v: any) => {
      if (v == null) return "";
      if (typeof v === "object") {
        if (v.richText) return v.richText.map((t: any) => t.text).join("");
        return String(v.text ?? v.result ?? "");
      }
      return String(v);
    }));
  });
  return rows;
}

// Finds the biggest array of objects in JSON data that looks like a chart.
function entriesFromJson(data: unknown): ListEntry[] {
  let best: ListEntry[] = [];
  const pick = (obj: Record<string, any>, pattern: RegExp): unknown => {
    for (const [key, value] of Object.entries(obj)) {
      if (pattern.test(headerName(key))) return value;
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const nested = pick(value, pattern);
        if (nested !== undefined) return nested;
      }
    }
    return undefined;
  };
  const asNumber = (v: unknown): number => {
    if (v && typeof v === "object") v = pick(v as Record<string, any>, /^(current|value|position|positie)$/);
    return parseInt(String(v), 10);
  };
  const asText = (v: unknown): string => {
    if (Array.isArray(v)) return v.map(asText).join(", ");
    if (v && typeof v === "object") return asText(pick(v as Record<string, any>, /^(name|naam|title|titel)$/) ?? "");
    return v == null ? "" : String(v);
  };
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      if (node.length >= 1000 && node.every((n) => n && typeof n === "object")) {
        const entries = node.map((item: Record<string, any>) => ({
          placement: asNumber(pick(item, HEADER_PATTERNS.placement)),
          title: asText(pick(item, HEADER_PATTERNS.title)).trim(),
          artist: asText(pick(item, HEADER_PATTERNS.artist)).trim(),
          year: (() => {
            const y = asNumber(pick(item, HEADER_PATTERNS.year));
            return Number.isNaN(y) ? null : y;
          })(),
        })).filter((e) => e.title && e.artist && !Number.isNaN(e.placement));
        if (entries.length > best.length) best = entries;
      }
      node.forEach(walk);
    } else if (node && typeof node === "object") {
      Object.values(node).forEach(walk);
    }
  };
  walk(data);
  return best;
}

async function entriesFromSource(url: string): Promise<ListEntry[]> {
  const buffer = await fetchBuffer(url);
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".xlsx") || buffer.subarray(0, 2).toString() === "PK") {
    return entriesFromRows(await parseXlsx(buffer));
  }
  const text = buffer.toString("utf8");
  if (lower.endsWith(".json") || /^\s*[[{]/.test(text)) return entriesFromJson(JSON.parse(text));
  if (/<html/i.test(text)) return entriesFromPage(text, url);
  return entriesFromRows(parseCsv(text));
}

// A web page with the list: an Excel/CSV download link, or chart data embedded in the page.
async function entriesFromPage(html: string, pageUrl: string): Promise<ListEntry[]> {
  const downloads = [...html.matchAll(/href="([^"]+\.(?:xlsx|csv)(?:\?[^"]*)?)"/gi)].map((m) => absoluteUrl(m[1], pageUrl));
  console.log(`${pageUrl}: downloads found: ${downloads.join(", ") || "none"}`);
  for (const download of downloads) {
    try {
      const entries = await entriesFromSource(download);
      if (entries.length >= 1900) return entries;
      console.log(`${download}: only ${entries.length} entries`);
    } catch (error) {
      console.log(`Could not read ${download}: ${(error as Error).message}`);
    }
  }
  return entriesFromHtml(html);
}

// Dry runs list the links a page has, to see where NPO puts the list this year.
function logLinks(html: string, pageUrl: string) {
  if (!DRY_RUN) return;
  const links = new Set(
    [...html.matchAll(/(?:href|src)="([^"]*)"/gi)]
      .map((m) => m[1])
      .filter((href) => /top-?2000|chart|lijst|\.xlsx|\.csv|\.pdf|api/i.test(href)),
  );
  console.log(`${pageUrl}: ${links.size} relevant links:\n  ${[...links].slice(0, 60).join("\n  ")}`);
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    try {
      const data = JSON.parse(nextData[1]);
      console.log(`${pageUrl}: __NEXT_DATA__ page=${data.page} pageProps keys=${Object.keys(data.props?.pageProps || {}).join(",")}`);
    } catch {}
  }
}

// Chart data embedded in an HTML page (Next.js __NEXT_DATA__ or other JSON script tags).
function entriesFromHtml(html: string): ListEntry[] {
  let best: ListEntry[] = [];
  for (const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = match[1].trim();
    if (!body.startsWith("{") && !body.startsWith("[")) continue;
    try {
      const entries = entriesFromJson(JSON.parse(body));
      if (entries.length > best.length) best = entries;
    } catch {}
  }
  return best;
}

function absoluteUrl(href: string, base: string): string {
  href = href.replace(/&amp;/g, "&");
  // SOURCE_URL can be a local file (for testing); resolve its links as files.
  if (!/^https?:\/\//.test(base) && !/^https?:\/\//.test(href)) return path.resolve(path.dirname(base), href);
  return new URL(href, base).toString();
}

// The list is announced in a news article ("Dit is de NPO Radio 2 Top 2000-lijst van <YEAR>")
// with an Excel download; the chart page only switches to the new edition later.
async function findOnNpo(): Promise<{ source: string; entries: ListEntry[] } | null> {
  const articleUrls = new Set<string>();
  for (const page of NPO_PAGES) {
    try {
      const html = await fetchText(page);
      logLinks(html, page);
      for (const m of html.matchAll(/href="([^"]*top-?2000-lijst-van-(\d{4})[^"]*)"/gi)) {
        if (parseInt(m[2], 10) === YEAR) articleUrls.add(absoluteUrl(m[1], page));
      }
      console.log(`${page}: ${html.length} characters, ${articleUrls.size} article link(s) for ${YEAR} so far`);
    } catch (error) {
      console.log(`Could not read ${page}: ${(error as Error).message}`);
    }
  }

  for (const article of articleUrls) {
    try {
      const html = await fetchText(article);
      logLinks(html, article);
      const entries = await entriesFromPage(html, article);
      if (entries.length >= 1900) return { source: article, entries };
    } catch (error) {
      console.log(`Could not read ${article}: ${(error as Error).message}`);
    }
  }

  try {
    const entries = entriesFromHtml(await fetchText(NPO_CHART_PAGE));
    console.log(`${NPO_CHART_PAGE}: ${entries.length} chart entries found`);
    if (entries.length >= 1900) return { source: NPO_CHART_PAGE, entries };
  } catch (error) {
    console.log(`Could not read ${NPO_CHART_PAGE}: ${(error as Error).message}`);
  }
  return null;
}

// The chart page keeps showing last year's list until the new edition starts.
function isSameAsPreviousList(entries: ListEntry[]): boolean {
  const previousFile = path.join(EMBEDDED_DIR, `top2000_top${YEAR - 1}.ts`);
  if (!fs.existsSync(previousFile)) return false;
  const previous = readSongFile(previousFile);
  const byPlacement = new Map(previous.map((s) => [s.placement, songKey(s.artist, s.title)]));
  const top = entries.filter((e) => e.placement <= 100);
  const same = top.filter((e) => byPlacement.get(e.placement) === songKey(e.artist, e.title)).length;
  return top.length > 0 && same === top.length;
}

function validate(entries: ListEntry[]): void {
  const placements = new Set(entries.map((e) => e.placement));
  if (entries.length < 1900 || placements.size !== entries.length || !placements.has(1)) {
    throw new Error(`List does not look like a Top 2000: ${entries.length} entries, ${placements.size} unique positions`);
  }
}

/* -------------------- Spotify and YouTube -------------------- */

async function spotifyToken(): Promise<string | null> {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    report(`⚠️ Spotify login failed (HTTP ${res.status}); skipping Spotify lookups.`);
    return null;
  }
  return (await res.json()).access_token;
}

async function searchSpotify(token: string, song: ListEntry): Promise<{ uri: string; year: number | null } | null> {
  for (const q of [`track:${song.title} artist:${song.artist}`, `${song.artist} ${song.title}`]) {
    const url = `https://api.spotify.com/v1/search?type=track&limit=5&q=${encodeURIComponent(q)}`;
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 429) {
      const wait = parseInt(res.headers.get("retry-after") || "5", 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!res.ok) throw new Error(`Spotify search HTTP ${res.status}`);
    const items: any[] = (await res.json()).tracks?.items || [];
    const artistKey = normalize(song.artist, true);
    const sameArtist = (name: string) => {
      const key = normalize(name, true);
      return !!key && !!artistKey && (artistKey.includes(key) || key.includes(artistKey));
    };
    const match =
      items.find((t) => t.artists?.some((a: any) => sameArtist(a.name))) ||
      (q.startsWith("track:") ? items[0] : undefined);
    if (match) {
      const year = parseInt(String(match.album?.release_date || "").slice(0, 4), 10);
      return { uri: match.uri, year: Number.isNaN(year) ? null : year };
    }
  }
  return null;
}

class QuotaExceeded extends Error {}

async function searchYouTube(key: string, song: ListEntry): Promise<string | null> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "1",
    q: `${song.artist} ${song.title}`,
    key,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (res.status === 403) {
    const body = await res.text();
    if (/quota/i.test(body)) throw new QuotaExceeded();
    throw new Error(`YouTube search HTTP 403: ${body.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`YouTube search HTTP ${res.status}`);
  return (await res.json()).items?.[0]?.id?.videoId || null;
}

/* -------------------- Main -------------------- */

async function loadOrCreatePending(): Promise<PendingSong[] | null> {
  if (!DRY_RUN && fs.existsSync(PENDING_FILE)) {
    report(`Continuing with ${path.relative(ROOT, PENDING_FILE)}.`);
    return JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
  }

  let found: { source: string; entries: ListEntry[] } | null = null;
  if (process.env.SOURCE_URL) {
    found = { source: process.env.SOURCE_URL, entries: await entriesFromSource(process.env.SOURCE_URL) };
  } else {
    found = await findOnNpo();
  }
  if (!found || isSameAsPreviousList(found.entries)) return null;

  validate(found.entries);
  report(`Found the Top 2000 of ${YEAR} (${found.entries.length} songs) at ${found.source}.`);

  const known = loadKnownSongs();
  const songs = found.entries
    .sort((a, b) => a.placement - b.placement)
    .map((entry): PendingSong => {
      const match = known.get(songKey(entry.artist, entry.title)) || known.get(songKey(entry.artist, entry.title, true));
      return {
        ...entry,
        year: entry.year ?? match?.year ?? null,
        youtubeId: match?.youtubeId || null,
        spotifyUri: match?.spotifyUri || null,
        youtubeSearched: !!match?.youtubeId,
        spotifySearched: !!match?.spotifyUri,
      };
    });
  const reused = songs.filter((s) => s.youtubeSearched || s.spotifySearched).length;
  report(`Reused data from earlier lists for ${reused} songs; ${songs.length - reused} songs are new to us.`);
  return songs;
}

async function main() {
  if (DRY_RUN) report("Dry run: nothing will be written.");
  if (!DRY_RUN && fs.existsSync(OUTPUT_FILE)) {
    report(`${path.relative(ROOT, OUTPUT_FILE)} already exists; nothing to do.`);
    return;
  }

  const songs = await loadOrCreatePending();
  if (!songs) {
    report(`The Top 2000 of ${YEAR} is not published yet (or could not be found).`);
    if (process.env.FAIL_IF_NOT_FOUND === "true") {
      report("Set SOURCE_URL (workflow input) to the list's Excel/CSV download to import it manually.");
      process.exitCode = 1;
    }
    return;
  }

  const token = await spotifyToken();
  if (token) {
    let found = 0;
    for (const song of songs.filter((s) => !s.spotifySearched).slice(0, SPOTIFY_SEARCH_LIMIT)) {
      const result = await searchSpotify(token, song);
      song.spotifySearched = true;
      if (result) {
        song.spotifyUri = result.uri;
        song.year = song.year ?? result.year;
        found++;
      }
    }
    report(`Spotify: found ${found} new links.`);
  } else if (songs.some((s) => !s.spotifySearched)) {
    report("⚠️ No Spotify credentials; Spotify links for new songs are skipped.");
    songs.forEach((s) => (s.spotifySearched = true));
  }

  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (youtubeKey) {
    let searches = 0;
    let found = 0;
    try {
      for (const song of songs.filter((s) => !s.youtubeSearched)) {
        if (searches >= YOUTUBE_SEARCH_LIMIT) break;
        song.youtubeId = await searchYouTube(youtubeKey, song);
        song.youtubeSearched = true;
        searches++;
        if (song.youtubeId) found++;
      }
    } catch (error) {
      if (!(error instanceof QuotaExceeded)) throw error;
      report("YouTube quota used up for today; continuing on the next run.");
    }
    report(`YouTube: ${searches} searches, found ${found} new videos.`);
  } else if (songs.some((s) => !s.youtubeSearched)) {
    report("⚠️ No YOUTUBE_API_KEY; the list is published without YouTube videos for new songs.");
    songs.forEach((s) => (s.youtubeSearched = true));
  }

  if (DRY_RUN) {
    const sample = songs.slice(0, 5).concat(songs.filter((s) => !s.youtubeId || !s.spotifyUri).slice(0, 10));
    report(
      "Sample (first songs, then songs still missing a link):\n\n" +
        sample.map((s) => `- #${s.placement} ${s.artist} – ${s.title} (${s.year ?? "?"}): youtube=${s.youtubeId ?? "-"} spotify=${s.spotifyUri ?? "-"}`).join("\n"),
    );
    return;
  }

  const remaining = songs.filter((s) => !s.youtubeSearched).length;
  if (remaining > 0) {
    fs.mkdirSync(PENDING_DIR, { recursive: true });
    fs.writeFileSync(PENDING_FILE, JSON.stringify(songs, null, 2) + "\n");
    report(`${remaining} songs still need a YouTube lookup; progress saved for the next run.`);
    setOutput("changed", "true");
    return;
  }

  const output: Song[] = songs.map((s) => ({
    id: s.placement,
    placement: s.placement,
    artist: s.artist,
    title: s.title,
    year: s.year ?? 0,
    youtubeId: s.youtubeId || "",
    spotifyUri: s.spotifyUri,
  }));
  fs.writeFileSync(
    OUTPUT_FILE,
    `import type { Song } from "../songs-data";\n\nexport const songs: Song[] = ${JSON.stringify(output, null, 2)};\n`,
  );
  if (fs.existsSync(PENDING_FILE)) fs.unlinkSync(PENDING_FILE);
  execFileSync("npx", ["tsx", path.join(ROOT, "scripts", "generate-index.ts")], { stdio: "inherit" });

  const missing = output.filter((s) => !s.youtubeId || !s.spotifyUri);
  report(`✅ Published ${path.relative(ROOT, OUTPUT_FILE)} as the new default list.`);
  if (missing.length > 0) {
    report(
      `Songs without a YouTube video or Spotify link (${missing.length}):\n\n` +
        missing.map((s) => `- #${s.placement} ${s.artist} – ${s.title}${s.youtubeId ? "" : " (no YouTube)"}${s.spotifyUri ? "" : " (no Spotify)"}`).join("\n"),
    );
  }
  setOutput("changed", "true");
  setOutput("published", "true");
}

main()
  .catch((error) => {
    report(`❌ ${(error as Error).message}`);
    process.exitCode = 1;
  })
  .finally(writeSummary);
