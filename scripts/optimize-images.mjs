// One-off/occasional asset pipeline pass (perf audit, 2026-07-23): source art
// lands at full camera/render resolution (multi-MB PNGs/JPEGs) but only ever
// displays in small fixed CSS boxes. Re-run this whenever new portrait art or
// a new map background is dropped into src/assets/ before committing it.
//
// Usage: node scripts/optimize-images.mjs

import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.join(import.meta.dirname, '..');
const PORTRAITS_DIR = path.join(ROOT, 'src/assets/portraits');
const MAP_FILE = path.join(ROOT, 'src/assets/ui/ashmark_map.jpg');

// Largest portrait box in the UI is .hero-sheet-portrait at 164x205 (styles.css).
// 2x that for retina headroom, then let object-fit: cover crop to the box.
const PORTRAIT_HEIGHT = 410;
const PORTRAIT_QUALITY = 82;

// The map SVG <image> is stretched to a fixed 1000x750 viewBox with
// preserveAspectRatio="none" (MapScreen.tsx) — match that exactly, 2x for zoom headroom.
const MAP_WIDTH = 2000;
const MAP_HEIGHT = 1500;
const MAP_QUALITY = 78;

async function fileSize(file) {
  return (await stat(file)).size;
}

async function optimizePortraits() {
  const cultureDirs = await readdir(PORTRAITS_DIR, { withFileTypes: true });
  let before = 0;
  let after = 0;
  let count = 0;

  for (const dirent of cultureDirs) {
    if (!dirent.isDirectory()) continue;
    const dir = path.join(PORTRAITS_DIR, dirent.name);
    const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.png'));

    for (const file of files) {
      const src = path.join(dir, file);
      const dest = path.join(dir, file.replace(/\.png$/i, '.webp'));
      before += await fileSize(src);

      await sharp(src)
        .resize({ height: PORTRAIT_HEIGHT })
        .webp({ quality: PORTRAIT_QUALITY })
        .toFile(dest);

      after += await fileSize(dest);
      await unlink(src);
      count += 1;
    }
  }

  console.log(
    `Portraits: ${count} files, ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB`,
  );
}

async function optimizeMap() {
  const before = await fileSize(MAP_FILE);
  const tmp = `${MAP_FILE}.tmp`;

  await sharp(MAP_FILE)
    .resize({ width: MAP_WIDTH, height: MAP_HEIGHT, fit: 'fill' })
    .jpeg({ quality: MAP_QUALITY, mozjpeg: true })
    .toFile(tmp);

  const after = await fileSize(tmp);
  await unlink(MAP_FILE);
  await (await import('node:fs/promises')).rename(tmp, MAP_FILE);

  console.log(`Map: ${(before / 1e6).toFixed(1)}MB -> ${(after / 1e6).toFixed(1)}MB`);
}

await optimizePortraits();
await optimizeMap();
