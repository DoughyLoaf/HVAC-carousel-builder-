import { scanText, describeFlag } from "@/lib/gates";
import { fail, json, parseId } from "@/lib/http";
import { photoMap } from "@/lib/photos";
import { getDetail } from "@/lib/service";
import { exportFolderName } from "@/lib/slug";
import { getCarousel } from "@/lib/sources";
import { slideState, updateCarouselState } from "@/lib/store";
import type { Permission, SlideState } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function payload(id: number) {
  const d = await getDetail(id);
  if (!d) return null;
  return {
    carousel: d.carousel,
    state: d.state,
    plan: d.plan,
    settings: d.settings,
    photos: d.photos,
    recorded_selects: d.recorded_selects,
    export_folder: `exports/${exportFolderName(d.carousel.id, d.carousel.title)}`,
    selects_checklist_file: d.sources.registry.selects_checklist_file,
  };
}

export async function GET(_req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return fail("Unknown carousel.", 404);
  const p = await payload(id);
  return p ? json(p) : fail("Unknown carousel.", 404);
}

interface SlidePatch {
  photo_filename?: string | null;
  crop?: { x?: number; y?: number; zoom?: number };
  permission?: Permission;
  inside_home?: boolean | null;
  override_text?: string | null;
  dropped?: boolean;
  natural_confirmed?: boolean;
  upscale_ack?: boolean;
}

const unit = (n: unknown, d: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d;
};

export async function PATCH(req: Request, { params }: Ctx) {
  const id = parseId((await params).id);
  if (id === null) return fail("Unknown carousel.", 404);
  const { carousel } = getCarousel(id);
  if (!carousel) return fail("Unknown carousel.", 404);
  if (carousel.status === "blocked") {
    return fail(`Carousel ${id} is blocked: ${carousel.blocked_reason}`, 409);
  }
  const parsed = carousel.parsed;
  if (!parsed || carousel.status === "source_missing" || carousel.status === "source_error") {
    return fail(carousel.status_reason ?? "This carousel has no readable source file.", 409);
  }

  let body: {
    slide?: number;
    patch?: SlidePatch;
    confirm_age?: { key: string; confirmed: boolean };
  };
  try {
    body = await req.json();
  } catch {
    return fail("Request was not valid JSON.");
  }

  // --- Gate 4: explicit confirmation of a "years old" line ---------------
  if (body.confirm_age) {
    const d = await getDetail(id);
    const occ = d?.plan.age_occurrences.find((a) => a.key === body.confirm_age!.key);
    if (!occ) return fail("That line is no longer in the source text.", 409);
    updateCarouselState(id, (cs) => {
      if (body.confirm_age!.confirmed) {
        cs.age_confirmations[occ.key] = { text: occ.text, confirmed_at: new Date().toISOString() };
      } else {
        delete cs.age_confirmations[occ.key];
      }
    });
    return json(await payload(id));
  }

  const n = Number(body.slide);
  const slide = parsed.slides.find((s) => s.number === n);
  const patch = body.patch;
  if (!slide || !patch) return fail("Unknown slide.", 404);

  if (patch.photo_filename) {
    const photos = await photoMap();
    if (!photos.has(patch.photo_filename)) {
      return fail(`${patch.photo_filename} is not in the photo library. Upload it first.`);
    }
  }
  if (patch.permission !== undefined && !["Y", "N", "unconfirmed"].includes(patch.permission)) {
    return fail("Permission must be Y, N or unconfirmed.");
  }
  if (patch.dropped && !carousel.droppable_slides.includes(n)) {
    return fail(`Slide ${n} cannot be dropped. Only a slide the source file allows to be dropped can be.`);
  }

  let overrideText: string | null | undefined;
  if (patch.override_text !== undefined) {
    if (patch.override_text === null) {
      overrideText = null;
    } else {
      if (carousel.locked_slides.includes(n)) {
        return fail(carousel.locked_note ?? `Slide ${n}'s text is locked.`, 409);
      }
      if (!slide.on_screen_text) {
        return fail(`Slide ${n} has no on-screen text in the source file. Fix the source file — text is not written here.`, 409);
      }
      const text = String(patch.override_text).replace(/\r\n?/g, "\n").trim();
      if (!text) return fail("Edited text cannot be empty. To go back, use \"Back to source text\".");
      const bad = scanText(text);
      if (bad.length) {
        return fail(
          `Edited text cannot contain ${bad.map(describeFlag).join(" or ")}. No prices, percentage claims or ages in edited slide text.`,
        );
      }
      overrideText = text === slide.on_screen_text ? null : text;
    }
  }

  updateCarouselState(id, (cs) => {
    const st: SlideState = slideState(cs, n);
    if (patch.photo_filename !== undefined && patch.photo_filename !== st.photo_filename) {
      // A different photo is a different decision: permission, crop and
      // confirmations all start again.
      st.photo_filename = patch.photo_filename;
      st.crop = { x: 0.5, y: 0.5, zoom: 1 };
      st.permission = "unconfirmed";
      st.inside_home = null;
      st.natural_confirmed = false;
      st.upscale_ack = false;
    }
    if (patch.crop) {
      const zoom = Number(patch.crop.zoom);
      st.crop = {
        x: unit(patch.crop.x, st.crop.x),
        y: unit(patch.crop.y, st.crop.y),
        zoom: Number.isFinite(zoom) ? Math.min(4, Math.max(1, zoom)) : st.crop.zoom,
      };
    }
    if (patch.permission !== undefined) st.permission = patch.permission;
    if (patch.inside_home !== undefined) {
      st.inside_home = patch.inside_home === null ? null : !!patch.inside_home;
    }
    if (overrideText !== undefined) {
      st.override =
        overrideText === null
          ? null
          : {
              text: overrideText,
              source_text_at_edit: slide.on_screen_text!,
              edited_at: new Date().toISOString(),
            };
    }
    if (patch.dropped !== undefined) st.dropped = !!patch.dropped;
    if (patch.natural_confirmed !== undefined) st.natural_confirmed = !!patch.natural_confirmed;
    if (patch.upscale_ack !== undefined) st.upscale_ack = !!patch.upscale_ack;
    cs.slides[String(n)] = st;
  });

  return json(await payload(id));
}
