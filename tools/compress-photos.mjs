#!/usr/bin/env node
/**
 * Resize and compress photos before uploading to Cloudinary.
 *
 * Usage:
 *   node tools/compress-photos.mjs <source> [--out <dir>] [--max <px>] [--quality <int>]
 *
 * Defaults:
 *   --out      <source>/../<source-name>-compressed
 *   --max      2400  (longest edge, px)
 *   --quality  85    (JPEG quality, 1-100)
 *
 * Skips files that already exist in the output directory.
 */
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { extname, join, parse, resolve, basename } from 'node:path';
import sharp from 'sharp';

const SUPPORTED = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function parseArgs(argv) {
  const args = { source: null, out: null, max: 2400, quality: 85 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') args.out = argv[++i];
    else if (arg === '--max') args.max = Number(argv[++i]);
    else if (arg === '--quality') args.quality = Number(argv[++i]);
    else if (arg === '-h' || arg === '--help') return null;
    else if (!args.source) args.source = arg;
  }
  if (!args.source) return null;
  return args;
}

function usage() {
  console.log(
    'Usage: node tools/compress-photos.mjs <source> [--out <dir>] [--max <px>] [--quality <int>]',
  );
}

async function compress({ source, out, max, quality }) {
  const src = resolve(source);
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    console.error(`Source directory not found: ${src}`);
    process.exit(1);
  }

  const dst = resolve(out ?? join(src, '..', `${basename(src)}-compressed`));
  mkdirSync(dst, { recursive: true });
  const existing = new Set(readdirSync(dst));

  console.log(`Source: ${src}`);
  console.log(`Output: ${dst}`);
  console.log(`Max edge: ${max}px, quality: ${quality}\n`);

  const files = readdirSync(src)
    .filter((name) => SUPPORTED.has(extname(name).toLowerCase()))
    .sort();

  let processed = 0;
  let skipped = 0;

  for (const name of files) {
    const outName = `${parse(name.replace(/\s+/g, '_')).name}.jpg`;
    if (existing.has(outName)) {
      skipped += 1;
      continue;
    }
    const inputPath = join(src, name);
    const outputPath = join(dst, outName);

    const image = sharp(inputPath, { failOn: 'none' }).rotate();
    const { width = 0, height = 0 } = await image.metadata();
    await image
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toFile(outputPath);

    const bytes = statSync(outputPath).size;
    const longest = Math.min(max, Math.max(width, height) || max);
    console.log(`${outName}: ~${longest}px longest edge, ${Math.round(bytes / 1024)} KB`);
    processed += 1;
  }

  console.log(`\nProcessed ${processed} new files, skipped ${skipped} existing`);
}

const args = parseArgs(process.argv.slice(2));
if (!args) {
  usage();
  process.exit(args === null && process.argv.length > 2 ? 1 : 0);
}
await compress(args);
