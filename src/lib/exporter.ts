// Export only. Writes files to the local exports folder.
// Nothing here posts, schedules, uploads or sends anything anywhere.

import fs from "node:fs";
import path from "node:path";
import { EXPORTS_DIR } from "./paths";
import { photoPath } from "./photos";
import { renderSlide } from "./render";
import { writeSelectsMap } from "./selectsMap";
import { getDetail, type CarouselDetail } from "./service";
import { slideState } from "./store";
import { exportFolderName, pad2 } from "./slug";
import { EXPORT_HEIGHT, EXPORT_JPG_QUALITY, EXPORT_WIDTH } from "./types";

export class ExportBlocked extends Error {
  constructor(public reasons: string[]) {
    super(reasons[0] ?? "Export blocked.");
  }
}

export interface ExportResult {
  folder: string;
  folder_name: string;
  files: string[];
  manifest: unknown;
}

export const slideFileName = (id: number, index: number) =>
  `carousel-${pad2(id)}-slide-${pad2(index)}.jpg`;

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Canva Bulk Create CSV — a secondary export. One row per exported slide. */
export function canvaCsv(detail: CarouselDetail): string {
  const { carousel, plan } = detail;
  if (!plan.exportable) throw new ExportBlocked(plan.errors);
  const rows = [["carousel", "slide", "on-screen text", "small line", "photo filename"]];
  for (const sp of plan.slides) {
    if (sp.dropped || sp.export_index === null) continue;
    rows.push([
      `Carousel ${carousel.id} — ${carousel.title}`,
      String(sp.export_index),
      sp.text ?? "",
      sp.small_line ?? "",
      sp.photo_used ?? "",
    ]);
  }
  // BOM so spreadsheet apps read the apostrophes and dashes correctly.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function buildManifest(detail: CarouselDetail, exportedAt: string) {
  const { carousel, plan, settings, state } = detail;
  const parsed = carousel.parsed!;
  return {
    carousel: {
      id: carousel.id,
      title: carousel.title,
      source_file: carousel.source_file,
      pairs_with: parsed.pairs_with,
      job_id: state.job_id ?? parsed.job_id ?? null,
    },
    export_date: exportedAt,
    exported_by: "CDA HVAC Carousel Builder — export only; nothing was posted, scheduled or sent.",
    template: {
      width: EXPORT_WIDTH,
      height: EXPORT_HEIGHT,
      jpg_quality: EXPORT_JPG_QUALITY,
      font_family: settings.font_family || "system sans (no brand font set)",
      text_size: settings.text_size,
      text_position: "bottom strip",
      text_bottom_margin: settings.text_bottom_margin,
      overlay_opacity: settings.overlay_opacity,
      template_colour: settings.template_colour,
      business_name: settings.business_name || null,
      brand_slide_text: settings.brand_slide_text || null,
      towns: settings.towns,
    },
    slide_count_in_source: parsed.slides.length,
    slide_count_exported: plan.slides.filter((s) => !s.dropped).length,
    slides: plan.slides
      .filter((s) => !s.dropped)
      .map((sp) => {
        const st = slideState(state, sp.number);
        return {
          export_slide: sp.export_index,
          source_slide: sp.number,
          file: slideFileName(carousel.id, sp.export_index!),
          photo: sp.photo_used ?? "text-slide fallback",
          slide_type: sp.mode === "photo" ? "photo" : sp.mode === "brand" ? "plain brand slide" : "text slide",
          fallback_used: !sp.photo_used,
          fallback_reason: sp.fallback_reason,
          photo_assigned_but_not_used: !sp.photo_used ? sp.photo_assigned : null,
          permission_required: sp.permission_required,
          permission_basis: sp.permission_basis,
          permission: sp.permission,
          permission_flag: sp.permission_flag,
          on_screen_text: sp.text,
          small_line: sp.small_line,
          edited_from_source: sp.edited_from_source,
          edit: sp.edited_from_source
            ? {
                flag: "Edited from source file",
                old_text: sp.source_text,
                new_text: sp.text,
                edited_at: st.override?.edited_at ?? null,
              }
            : null,
          crop: sp.photo_used ? st.crop : null,
          upscaled: sp.upscale
            ? { factor: Number(sp.upscale.factor.toFixed(3)), accepted_by_austin: sp.upscale.acknowledged }
            : null,
        };
      }),
    blocked_slides: plan.slides
      .filter((s) => !s.dropped && !!s.photo_assigned && !s.photo_used)
      .map((s) => ({
        source_slide: s.number,
        photo_blocked: s.photo_assigned,
        reason: s.fallback_reason,
        flag: s.permission_flag,
      })),
    dropped_slides: plan.slides
      .filter((s) => s.dropped)
      .map((s) => ({
        source_slide: s.number,
        reason: "Dropped by Austin — no natural-moment photo; not staged. Later slides renumbered.",
      })),
    confirmations: plan.age_occurrences.map((a) => ({
      where: a.where,
      matched: a.match,
      reel_1_22_years_old_line: a.reel1_line,
      confirmed: a.confirmed,
      confirmed_at: state.age_confirmations?.[a.key]?.confirmed_at ?? null,
    })),
    notices: plan.notices,
  };
}

export async function exportCarousel(id: number): Promise<ExportResult> {
  const detail = await getDetail(id);
  if (!detail) throw new ExportBlocked([`Carousel ${id} does not exist.`]);
  const { carousel, plan, settings, state } = detail;
  if (!plan.exportable) throw new ExportBlocked(plan.errors);
  const parsed = carousel.parsed!;

  // Render everything first; only touch the export folder once all slides are good.
  const rendered: { name: string; data: Buffer }[] = [];
  for (const sp of plan.slides) {
    if (sp.dropped) continue;
    const st = slideState(state, sp.number);
    const jpg = await renderSlide({
      mode: sp.mode,
      text: sp.text!,
      small_line: sp.small_line,
      photo_path: sp.photo_used ? photoPath(sp.photo_used) : null,
      crop: st.crop,
      settings,
    });
    rendered.push({ name: slideFileName(carousel.id, sp.export_index!), data: jpg });
  }

  const folderName = exportFolderName(carousel.id, carousel.title);
  const folder = path.join(EXPORTS_DIR, folderName);
  // Replace this carousel's previous export so stale slides never linger.
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(folder, { recursive: true });

  const exportedAt = new Date().toISOString();
  const manifest = buildManifest(detail, exportedAt);
  const files: string[] = [];
  const write = (name: string, data: string | Buffer) => {
    fs.writeFileSync(path.join(folder, name), data);
    files.push(name);
  };

  for (const r of rendered) write(r.name, r.data);
  // Caption exactly as in the file, a blank line, hashtags exactly as in the file.
  write("caption.txt", `${parsed.caption}\n\n${parsed.hashtags}\n`);
  write("gbp.txt", `${parsed.gbp_line}\n`);
  write("manifest.json", JSON.stringify(manifest, null, 2) + "\n");
  write(
    "selects-map.md",
    writeSelectsMap(carousel, parsed, plan, {
      date: exportedAt.slice(0, 10),
      exported: true,
      selects_source:
        carousel.origin === "shoot1" && detail.sources.registry.selects_checklist_file
          ? detail.sources.registry.selects_checklist_file
          : "the selects for this shoot / job",
    }) + "\n",
  );

  return { folder, folder_name: folderName, files, manifest };
}

/** Writes the Canva CSV next to an existing export, or on its own. */
export async function exportCanvaCsv(id: number): Promise<{ csv: string; file: string }> {
  const detail = await getDetail(id);
  if (!detail) throw new ExportBlocked([`Carousel ${id} does not exist.`]);
  const csv = canvaCsv(detail);
  const folder = path.join(EXPORTS_DIR, exportFolderName(detail.carousel.id, detail.carousel.title));
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, "canva-bulk-create.csv");
  fs.writeFileSync(file, csv);
  return { csv, file };
}
