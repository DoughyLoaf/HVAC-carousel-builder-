# CDA HVAC Carousel Builder

A local production tool for Cost2shoot's CDA HVAC work. It turns carousel copy
that is already written — as build-ready Markdown files — into export-ready
Instagram carousels, the same way every time:

1. read the carousel from its Markdown file,
2. drop the real stills into its slide slots,
3. export ordered 1080 × 1350 JPGs plus the caption, hashtags and GBP line.

It is **export only**. It does not post, schedule or send anything, it does not
write or suggest copy, and it does not pick photos.

## Run it

Needs Node.js 20 or newer.

```bash
npm install
npm run build
npm start          # http://127.0.0.1:3000
```

`npm run dev` also works while changing the code. The server listens on this
machine only. There are no logins, API keys or cloud services.

## Where things live

| Path | What |
|---|---|
| `content/` | Source copy files (Markdown). Read-only for the app. See `content/README.md`. |
| `content/new/` | Build-ready files the app saves from the **New carousel** screen. |
| `carousel-registry.json` | The eight Shoot 1 carousels, which file each comes from, and which are blocked. |
| `data/photos/` | The selects library — uploaded stills, under their exact file names. Not in git. |
| `data/state.json` | Slot assignments, crops, permissions, edits. Not in git. |
| `data/settings.json` | Template settings. Not in git. |
| `exports/carousel-<nn>-<slug>/` | Exported carousels. Not in git. |

## First run

Copy the build-ready files into `content/` (names in `content/README.md`). Until
they are there, the home screen lists each carousel as **Source file missing**
— nothing is filled in. The photo library starts empty; every slide exports as
its text-slide fallback until a photo is assigned.

## Screens

- **Carousels** — all carousels in order with status: Ready, Blocked (with the
  reason), Photos missing (count), or a source-file problem. Suggested posting
  order is shown, not enforced.
- **Carousel build view** — slide slots on the left (photo needed, on-screen
  text, small line, fallback, photo, permission). Live preview on the right,
  rendered by the same engine as the export. Drag the photo to reposition it,
  zoom to crop tighter. Export, caption / hashtags / GBP line to copy.
- **New carousel** — for Shoot 2 or a future job. Saved in the same Markdown
  format, read back by the same parser.
- **Template settings** — font family, text size, bottom margin, overlay
  opacity, template colour, business name, brand-slide text, towns.

## The template

Every slide is 1080 × 1350 px (4:5), JPG quality 90.

- **Photo slide** — photo full-bleed, dark gradient at the bottom, white text in
  the bottom strip. Photos are cropped, never stretched.
- **Text-slide fallback** — plain template colour, same text, same position.
- **Plain brand slide** — used for the last (CTA) slide when the file's fallback
  mentions a brand slide: business name and towns at the top, CTA text in the
  usual position.

The font, template colour and business name are settings with neutral
placeholders. Nothing about the brand is assumed.

## Gates

These stop the export or force the fallback. None can be clicked through.

1. **No photo** → the slide exports as its text-slide fallback, and the manifest
   says so.
2. **Homeowner permission** → every photo is treated as an inside-home photo
   unless the source file says `Inside home: no` or you mark it "No" on the
   slot. An inside-home photo is used only when permission is **Y**. Otherwise
   the text fallback is used and the manifest flags `permission unconfirmed`
   (or `permission denied`).
3. **Carousels 3 and 8 are blocked** in `carousel-registry.json` with their
   reasons. There is no button to unblock them. To unblock one later: write its
   build-ready file, set `source_file`, and remove `blocked_reason`.
4. **"Years old" lines** (including the Reel 1 "22 years old" line) → flagged
   wherever they appear in slide text, caption or GBP line. Export is blocked
   until each one is explicitly confirmed. A confirmation only holds for the
   exact text confirmed.
5. **Prices, percentages, ages** → rejected in any text typed into the app (an
   edit or a new carousel; ages in a new carousel go through gate 4). In text
   that is word for word from a build-ready file they are exported with a
   notice in the manifest.

Also enforced:

- A slide with no on-screen text in its file is blocked: "Missing copy in
  source file — do not generate text."
- On-screen text is read-only. A manual edit is stored separately with an
  "Edited from source file" flag, and the manifest logs old and new text. The
  Markdown file is never rewritten.
- A photo smaller than the frame is not enlarged without ticking "Use anyway".
- Carousel 6 slide 5 can be dropped (export is renumbered), and takes a photo
  only once it is confirmed as a natural, unstaged moment.
- Carousel 7 slide 5 cannot be edited or expanded.
- Videos are refused. Stills only.

## What an export contains

`exports/carousel-<nn>-<slug>/`

- `carousel-<nn>-slide-01.jpg` … — 1080 × 1350, JPG quality 90, in order
- `caption.txt` — caption, a blank line, hashtags, exactly as in the file
- `gbp.txt` — the GBP line, exactly as in the file
- `manifest.json` — carousel, export date, template settings, and per slide:
  photo file name or `text-slide fallback`, permission flag, edit flag with old
  and new text, blocked and dropped slides, confirmations
- `selects-map.md` — tick sheet: each slide, photo needed, file name used,
  fallback used

Secondary export: **Canva Bulk Create CSV** (`canva-bulk-create.csv`), one row
per slide: carousel, slide, on-screen text, small line, photo filename. Bulk
Create is a paid Canva Pro feature, desktop only, and images must be embedded
in the spreadsheet or already in the Canva library — image URLs do not work.

## Not in v1

No posting, scheduling or sending. No CRM, Radar, funnel or client-portal
connection. No AI images, stock photos or AI-written copy. No automatic photo
selection (the one exception: a file name recorded in a selects map can fill
its own slot).

The only seam to the CRM is a `job_id` field on each carousel and a disabled
"Seed from CRM job" button ("CRM not connected yet").

## Tests

```bash
npm test          # parser, gates, plan, export (uses synthetic fixture copy)
npm run typecheck
```

The test fixtures contain placeholder text only. No real carousel copy is in
this repository's code or tests.
