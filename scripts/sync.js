#!/usr/bin/env node

/**
 * Generate manifest.json and index.json for series content.
 *
 * Usage: node scripts/sync.js [series-id]
 *
 * 1. Finds series in series/
 * 2. Generates manifest.json for each series from directory structure
 * 3. Generates index.json with all series metadata (reads from series.json per series)
 *
 * Content is served via API route (/api/series/[...path]) from series/ folder.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SERIES_ROOT = path.join(ROOT, "series");

// --- Helpers ---

function listFiles(dir, extension = null) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => {
      if (!fs.statSync(path.join(dir, f)).isFile()) return false;
      return extension ? f.endsWith(extension) : true;
    })
    .sort();
}

function listWorldEntries(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  const mdFiles = files.filter((f) => f.endsWith(".md") && fs.statSync(path.join(dir, f)).isFile());

  return mdFiles.map((mdFile) => {
    const baseName = mdFile.replace(/\.md$/, "");
    const imageExts = [".jpg", ".png", ".webp"];
    const image = imageExts.find((ext) => files.includes(baseName + ext));
    return { file: mdFile, image: image ? baseName + image : null };
  }).sort((a, b) => a.file.localeCompare(b.file));
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isDirectory())
    .sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
}

// --- Series Discovery ---

function getAllSeriesIds() {
  if (!fs.existsSync(SERIES_ROOT)) {
    console.error("Error: series/ directory not found");
    process.exit(1);
  }

  return fs
    .readdirSync(SERIES_ROOT)
    .filter(
      (d) =>
        d !== "concepts" &&
        !d.endsWith(".json") &&
        fs.statSync(path.join(SERIES_ROOT, d)).isDirectory()
    );
}

function findSeries(seriesIdArg) {
  const allSeries = getAllSeriesIds();

  if (allSeries.length === 0) {
    console.error("Error: No series found in series/");
    process.exit(1);
  }

  if (seriesIdArg) {
    if (!allSeries.includes(seriesIdArg)) {
      console.error(`Error: series/${seriesIdArg} not found`);
      process.exit(1);
    }
    return [seriesIdArg];
  }

  // No argument: sync all series
  return allSeries;
}

function parseSeriesMd(seriesDir) {
  const mdPath = path.join(seriesDir, "series.md");
  if (!fs.existsSync(mdPath)) return { title: null, genre: null, description: null };

  const text = fs.readFileSync(mdPath, "utf-8");

  let title = null;
  // Try "# Series: Title" format first, then fall back to "# Title"
  const titleMatch = text.match(/^# Series:\s*(.+)$/m) || text.match(/^# (.+)$/m);
  if (titleMatch) title = titleMatch[1].trim();

  let genre = null;
  const genreMatch = text.match(/^## Genre\s*\n(.+?)(?:\n\n|\n##|$)/ms);
  if (genreMatch) {
    genre = genreMatch[1].trim().split("\n")[0].split(/\s*[—–]\s*/)[0].trim();
  }

  let description = null;
  const premiseMatch = text.match(/^## Premise\s*\n(.+?)(?:\n##|$)/ms);
  if (premiseMatch) {
    // Get first paragraph as the description
    description = premiseMatch[1].trim().split("\n\n")[0].trim();
  }

  return { title, genre, description };
}

// --- Manifest Generation ---

function generateManifest(seriesPath) {
  const manifest = {
    generated: new Date().toISOString(),
    chapters: [],
    arcs: [],
    sources: [],
    modules: [],
    meta: [],
    world: { characters: [], locations: [], elements: [] },
  };

  // Chapters
  const chaptersDir = path.join(seriesPath, "chapters");
  for (const num of listDirs(chaptersDir)) {
    const chapterPath = path.join(chaptersDir, num);
    const files = listFiles(chapterPath, ".md");
    const media = listFiles(path.join(chapterPath, "media"));
    const pagesDir = path.join(chapterPath, "pages");
    const pages = listDirs(pagesDir)
      .filter((d) => /^\d+$/.test(d))
      .map((d) => {
        const pageNum = parseInt(d);
        const pageFiles = listFiles(path.join(pagesDir, d)).filter(
          (f) => /\.(jpg|jpeg|png|webp)$/i.test(f) && f !== "page.jpg"
        );
        return { number: pageNum, files: pageFiles };
      });
    manifest.chapters.push({ number: parseInt(num), files, media, pages });
  }

  // Arcs
  const arcsDir = path.join(seriesPath, "arcs");
  for (const num of listDirs(arcsDir)) {
    const arcPath = path.join(arcsDir, num);
    const files = listFiles(arcPath, ".md");
    const arcSourcesDir = path.join(seriesPath, "sources", num);
    const sources = listFiles(arcSourcesDir, ".md");
    manifest.arcs.push({ number: parseInt(num), files, sources });
  }

  // Sources
  manifest.sources = listFiles(path.join(seriesPath, "sources"), ".md");

  // Modules
  manifest.modules = listFiles(path.join(seriesPath, "modules"), ".md");

  // Meta (root-level .md files)
  manifest.meta = listFiles(seriesPath, ".md");

  // World
  const worldDir = path.join(seriesPath, "world");
  manifest.world.characters = listWorldEntries(path.join(worldDir, "characters"));
  manifest.world.locations = listWorldEntries(path.join(worldDir, "locations"));
  manifest.world.elements = listWorldEntries(path.join(worldDir, "elements"));

  return manifest;
}

// --- Index & Webmanifest ---

function buildSeriesEntry(seriesId, title, genre, description) {
  const seriesDir = path.join(SERIES_ROOT, seriesId);
  const seriesJsonPath = path.join(seriesDir, "series.json");

  // If series.json exists, use it as the source of truth for metadata
  if (fs.existsSync(seriesJsonPath)) {
    try {
      const seriesJson = JSON.parse(fs.readFileSync(seriesJsonPath, "utf-8"));
      return {
        id: seriesId,
        title: seriesJson.title || title || seriesId,
        genre: seriesJson.genre || genre || "",
        description: seriesJson.description || description || "",
        author: seriesJson.author || null,
        cover: seriesJson.cover || "cover.jpg",
        background: seriesJson.background || "background.jpg",
        donationLink: seriesJson.donationLink || null,
      };
    } catch (err) {
      console.warn(`  Warning: Failed to parse series.json for ${seriesId}`);
    }
  }

  // Fallback: build from series.md metadata only (no author/donation info)
  return {
    id: seriesId,
    title: title || seriesId,
    genre: genre || "",
    description: description || "",
    author: null,
    cover: "cover.jpg",
    background: "background.jpg",
    donationLink: null,
  };
}

function generateIndexJson(seriesEntries) {
  // Write to series/index.json (root level, served via /api/series/index.json)
  const indexPath = path.join(SERIES_ROOT, "index.json");

  // Always output as array for consistency
  fs.writeFileSync(indexPath, JSON.stringify(seriesEntries, null, 2) + "\n");
}

// --- Main ---

const seriesIds = findSeries(process.argv[2]);
const seriesEntries = [];

console.log(`Found ${seriesIds.length} series to sync\n`);

for (const seriesId of seriesIds) {
  const seriesDir = path.join(SERIES_ROOT, seriesId);
  const { title, genre, description } = parseSeriesMd(seriesDir);

  console.log(`Syncing: series/${seriesId}`);
  console.log(`  Title: ${title || "(not found)"}`);
  console.log(`  Genre: ${genre || "(not found)"}`);

  // Generate manifest.json in series/{id}/
  const manifest = generateManifest(seriesDir);
  const manifestPath = path.join(seriesDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `  Manifest: ${manifest.chapters.length} chapters, ${manifest.arcs.length} arcs`
  );

  // Build series entry for index.json
  const entry = buildSeriesEntry(seriesId, title, genre, description);
  seriesEntries.push(entry);

  console.log("");
}

// Generate index.json at series root (served via /api/series/index.json)
generateIndexJson(seriesEntries);
console.log(`Generated series/index.json with ${seriesEntries.length} series`);

console.log("\nDone.");
