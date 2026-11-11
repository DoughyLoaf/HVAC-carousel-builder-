# content/ — source copy files

The app reads its copy from the Markdown files in this folder, fresh from disk
every time. It never writes copy, and it never rewrites these files.

## Files it expects for Shoot 1

Copy these in as they are (same file names):

| File | Used for |
|---|---|
| `cda-hvac-carousels-1-2-build-ready.md` | Carousels 1 and 2 — **required** |
| `cda-hvac-carousels-4-5-build-ready.md` | Carousels 4 and 5 — **required** |
| `cda-hvac-carousels-6-7-build-ready.md` | Carousels 6 and 7 — **required** |
| `cda-hvac-carousel-1-2-selects-map.md` | File names recorded here can fill matching slots (exact file name only) |
| `cda-hvac-shoot1-carousels.md` | All 8 outlines — reference |
| `end-of-day-selects-checklist.md` | Nov 2 selects list — reference |

Until a required file is here, its carousels show **Source file missing** on the
home screen. Carousels 3 and 8 stay **Blocked** whatever is in this folder (see
`carousel-registry.json`).

## New carousels (Shoot 2, future jobs)

- Carousels made on the **New carousel** screen are saved to `content/new/`.
- A hand-written file also works: drop any `*build-ready*.md` file in this
  folder. Give its carousels numbers that are not already used.

## Build-ready file format

```markdown
## Carousel 9 — "Title in quotes" (6 slides, pairs with Reel 3)

### Slide 1
- **Photo needed:** what the photo should show
- **On-screen text:** "Exact words, in quotes"
- **Small line:** "Optional smaller line"
- **Fallback:** plain text slide, same words, no photo

### Slide 2
...

### Caption
Caption text, exactly as it should be pasted.

### Hashtags
#one #two

### GBP repurpose
One line for the weekly GBP post.
```

What the parser accepts and what it refuses:

- Heading levels, `**bold**` labels and bullets are flexible. Slides can also
  be a Markdown table with a `Slide` column.
- On-screen text is taken word for word from inside the quotes. Two quoted
  parts (`"Line one." / "Line two."`) become two lines on the slide.
- `Inside home: no` on a slide means the photo needs no homeowner permission.
  Without that line, every photo is treated as an inside-home photo.
- A slide with no on-screen text is **blocked** ("Missing copy in source file —
  do not generate text."). It is never filled in.
- Slides must be numbered 1…N with none missing, the count must match the
  heading, and Caption, Hashtags and GBP repurpose must all be present.
  Otherwise the carousel fails with the file name and slide number.
