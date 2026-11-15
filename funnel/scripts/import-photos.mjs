// Copies photos from a folder (e.g. "CDA EDIT") into public/photos/ as web-sized
// JPEGs. Originals are never modified.
//
//   npm run photos:import -- "/Users/you/Pictures/CDA EDIT"
//
// Each photo is resized to at most 2400px on its long edge, rotated upright,
// and saved WITHOUT its metadata — camera EXIF includes GPS coordinates, and a
// customer's home address has no business on a public website.
//
// After importing, assign file names to slots in content/site.ts.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source || !fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
  console.error('Give the folder that holds the photos, e.g.  npm run photos:import -- "/path/to/CDA EDIT"');
  process.exit(1);
}
const outDir = path.join(import.meta.dirname, "..", "public", "photos");
fs.mkdirSync(outDir, { recursive: true });

const IMAGE = /\.(jpe?g|png|webp|tiff?|heic|heif|avif)$/i;
const files = fs.readdirSync(source).filter((f) => IMAGE.test(f) && !f.startsWith(".")).sort();
if (files.length === 0) {
  console.error(`No photos found in ${source}. (Videos and RAW files are skipped.)`);
  process.exit(1);
}

const webName = (file) =>
  `${path.parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "photo"}.jpg`;

const taken = new Map();
let ok = 0;
const failed = [];
for (const file of files) {
  const name = webName(file);
  if (taken.has(name)) {
    failed.push(`${file}: would overwrite ${taken.get(name)} (both become ${name}). Rename one and run again.`);
    continue;
  }
  taken.set(name, file);
  try {
    const info = await sharp(path.join(source, file))
      .rotate() // apply the camera's orientation, then drop it with the rest of the metadata
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(outDir, name));
    console.log(`  ${name.padEnd(44)} ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
    ok += 1;
  } catch (err) {
    failed.push(`${file}: ${err.message}`);
  }
}

console.log(`\nImported ${ok} of ${files.length} photo${files.length === 1 ? "" : "s"} into public/photos/.`);
if (failed.length > 0) {
  console.error(`\nNot imported:\n${failed.map((f) => `  ${f}`).join("\n")}`);
  process.exitCode = 1;
}
console.log("Next: put file names into the slots in content/site.ts, write alt text, and record homeowner permission.");
