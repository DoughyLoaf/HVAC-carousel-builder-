// Decides, for every slide, exactly what will be exported and why.
// One function, used by the preview, the export check and the export itself,
// so what Austin sees is what gets written. Pure — no I/O.

import { describeFlag, scanText } from "./gates";
import { slideState } from "./store";
import {
  EXPORT_HEIGHT,
  EXPORT_WIDTH,
  type AgeOccurrence,
  type Carousel,
  type CarouselPlan,
  type CarouselState,
  type PhotoInfo,
  type Settings,
  type SlidePlan,
} from "./types";

export function coverScale(photo: { width: number; height: number }, zoom: number): number {
  return Math.max(EXPORT_WIDTH / photo.width, EXPORT_HEIGHT / photo.height) * Math.max(1, zoom);
}

export function computePlan(
  carousel: Carousel,
  cs: CarouselState,
  settings: Settings,
  photos: Map<string, PhotoInfo>,
): CarouselPlan {
  const errors: string[] = [];
  const notices: string[] = [];
  const slides: SlidePlan[] = [];
  const ages: AgeOccurrence[] = [];

  if (carousel.status === "blocked") {
    errors.push(`Carousel ${carousel.id} is blocked: ${carousel.blocked_reason}`);
  } else if (carousel.status === "source_missing") {
    errors.push(carousel.status_reason ?? "Source file missing.");
  } else if (carousel.status === "source_error") {
    errors.push(...carousel.errors);
  }

  const parsed = carousel.status === "blocked" ? null : carousel.parsed;
  if (!parsed || carousel.status === "source_missing" || carousel.status === "source_error") {
    return {
      carousel_id: carousel.id,
      exportable: false,
      errors,
      notices,
      slides,
      age_occurrences: ages,
      photos_missing: 0,
    };
  }

  const total = parsed.slides.length;
  let exportIndex = 0;
  let photosMissing = 0;

  const addAge = (key: string, where: string, text: string | null) => {
    for (const f of scanText(text)) {
      if (f.kind !== "age") continue;
      const c = cs.age_confirmations?.[key];
      ages.push({
        key,
        where,
        text: text!,
        match: f.match,
        reel1_line: f.reel1_line,
        confirmed: !!c && c.text === text,
      });
      break; // one confirmation per location
    }
  };

  for (const s of parsed.slides) {
    const st = slideState(cs, s.number);
    const droppable = carousel.droppable_slides.includes(s.number);
    const naturalOnly = carousel.natural_moment_slides.includes(s.number);
    const locked = carousel.locked_slides.includes(s.number);
    const dropped = droppable && st.dropped;
    const isCta = s.number === total;
    const sErrors: string[] = [];
    const sNotices: string[] = [];
    const label = `Slide ${s.number}`;

    // --- Text -----------------------------------------------------------
    let text = s.on_screen_text;
    let edited = false;
    if (st.override && s.on_screen_text) {
      if (locked) {
        sErrors.push(`${label}: this slide's text is locked and cannot be edited. Remove the edit.`);
      } else if (st.override.source_text_at_edit !== s.on_screen_text) {
        sErrors.push(
          `${label}: the source file's text changed after this slide was edited. Review the edit (keep it or go back to the source text).`,
        );
        text = st.override.text;
        edited = true;
      } else {
        text = st.override.text;
        edited = true;
      }
      if (edited) {
        const bad = scanText(text);
        if (bad.length) {
          sErrors.push(
            `${label}: edited text contains ${bad.map(describeFlag).join(" and ")}. Only text that is word for word from a build-ready file can carry these — edits cannot.`,
          );
        }
      }
    }
    if (s.blocked) {
      sErrors.push(`${label}: ${s.blocked}`);
    }

    // Gate 5 on verbatim source text: prices / percentages are allowed only
    // because they are word for word from the file — say so. Ages go to gate 4.
    if (!dropped && !edited) {
      for (const f of [...scanText(s.on_screen_text), ...scanText(s.small_line)]) {
        if (f.kind !== "age") {
          sNotices.push(`${label}: contains ${describeFlag(f)} — exported only because it is word for word from the source file.`);
        }
      }
    }
    if (!dropped) {
      if (!edited) addAge(`slide-${s.number}-text`, `${label} on-screen text`, s.on_screen_text);
      addAge(`slide-${s.number}-small`, `${label} small line`, s.small_line);
    }

    // --- Photo ----------------------------------------------------------
    const assigned = st.photo_filename;
    const info = assigned ? photos.get(assigned) : undefined;
    const permissionRequired = st.inside_home === null ? s.permission_required : st.inside_home;
    const permissionBasis =
      st.inside_home === null
        ? s.permission_basis
        : st.inside_home
          ? "Marked by Austin as an inside-home photo."
          : "Marked by Austin as NOT an inside-home photo.";

    let photoUsed: string | null = null;
    let fallbackReason: string | null = null;
    let permissionFlag: string | null = null;
    let upscale: SlidePlan["upscale"] = null;

    if (!assigned) {
      fallbackReason = "no photo assigned";
    } else if (!info) {
      fallbackReason = `photo file not found in the library (${assigned})`;
    } else if (naturalOnly && !st.natural_confirmed) {
      fallbackReason = "photo not confirmed as a natural, unstaged moment from the shoot";
    } else if (permissionRequired && st.permission !== "Y") {
      permissionFlag = st.permission === "N" ? "permission denied" : "permission unconfirmed";
      fallbackReason = `inside-home photo blocked — homeowner ${permissionFlag}`;
    } else {
      photoUsed = assigned;
      const factor = coverScale(info, st.crop.zoom);
      if (factor > 1.005) {
        upscale = { factor, acknowledged: st.upscale_ack };
        const pct = Math.round((factor - 1) * 100);
        if (!st.upscale_ack) {
          sErrors.push(
            `${label}: ${assigned} is ${info.width} × ${info.height} px and would be enlarged ${pct}% past its native resolution${st.crop.zoom > 1 ? " at this zoom" : ""}. Tick "Use anyway" on the slide${st.crop.zoom > 1 ? ", zoom out," : ""} or pick a larger photo.`,
          );
        } else {
          sNotices.push(`${label}: photo is enlarged ${pct}% past its native resolution (accepted).`);
        }
      }
    }

    if (!dropped && !photoUsed) photosMissing++;

    const brandFallback = isCta && !!s.fallback_text && /brand/i.test(s.fallback_text);
    const mode = photoUsed ? "photo" : brandFallback ? "brand" : "text";

    if (!dropped) {
      if (!photoUsed) {
        sNotices.push(
          `${label}: exports as a ${mode === "brand" ? "plain brand slide" : "text slide"} — ${fallbackReason}.`,
        );
      }
      if (mode === "brand" && !settings.business_name.trim()) {
        sErrors.push(
          `${label}: the file's fallback is a plain brand slide with the business name, but no business name is set. Add it in Settings (it is a placeholder until then) or assign a photo.`,
        );
      }
    }

    slides.push({
      number: s.number,
      export_index: dropped ? null : ++exportIndex,
      dropped,
      droppable,
      natural_moment_only: naturalOnly,
      locked,
      is_cta: isCta,
      text,
      small_line: s.small_line,
      edited_from_source: edited,
      source_text: s.on_screen_text,
      mode,
      photo_used: photoUsed,
      photo_assigned: assigned,
      fallback_reason: photoUsed ? null : fallbackReason,
      permission_required: permissionRequired,
      permission_basis: permissionBasis,
      permission: st.permission,
      permission_flag: permissionFlag,
      upscale,
      blocked: s.blocked,
      errors: dropped ? [] : sErrors,
      notices: dropped ? [`${label}: dropped — not exported, later slides renumbered.`] : sNotices,
    });
  }

  addAge("caption", "Caption", parsed.caption);
  addAge("gbp", "GBP line", parsed.gbp_line);

  for (const a of ages) {
    if (!a.confirmed) {
      errors.push(
        a.reel1_line
          ? `${a.where} contains the "22 years old" line ("${a.match}"). That line is [VERIFY] for the Reel 1 job only and must not be reused. It needs explicit confirmation before export.`
          : `${a.where} contains a "years old" age ("${a.match}"). It needs explicit confirmation that this is a verified fact for this job before export.`,
      );
    } else {
      notices.push(`${a.where}: "${a.match}" confirmed by Austin.`);
    }
  }
  for (const f of [...scanText(parsed.caption), ...scanText(parsed.gbp_line)]) {
    if (f.kind !== "age") {
      notices.push(`Caption / GBP line contains ${describeFlag(f)} — word for word from the source file.`);
    }
  }

  for (const sp of slides) {
    errors.push(...sp.errors);
    notices.push(...sp.notices);
  }

  return {
    carousel_id: carousel.id,
    exportable: errors.length === 0,
    errors,
    notices,
    slides,
    age_occurrences: ages,
    photos_missing: photosMissing,
  };
}
