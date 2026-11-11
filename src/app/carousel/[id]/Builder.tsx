"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Carousel,
  CarouselPlan,
  CarouselState,
  Crop,
  ParsedSlide,
  Permission,
  PhotoInfo,
  Settings,
  SlidePlan,
  SlideState,
} from "@/lib/types";

interface Detail {
  carousel: Carousel;
  state: CarouselState;
  plan: CarouselPlan;
  settings: Settings;
  photos: PhotoInfo[];
  recorded_selects: Record<string, string>;
  export_folder: string;
  selects_checklist_file: string;
}

interface ExportResult {
  folder: string;
  folder_name: string;
  files: string[];
}

const W = 1080;
const H = 1350;
const DEFAULT_CROP: Crop = { x: 0.5, y: 0.5, zoom: 1 };

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function slideSig(sp: SlidePlan, crop: Crop, settings: Settings): string {
  return hash(
    JSON.stringify([sp.mode, sp.text, sp.small_line, sp.photo_used, crop.x, crop.y, crop.zoom, settings]),
  );
}

const cropOf = (state: CarouselState, n: number): Crop =>
  (state.slides[String(n)] as SlideState | undefined)?.crop ?? DEFAULT_CROP;

function modeLabel(sp: SlidePlan): { text: string; cls: string } {
  if (sp.dropped) return { text: "Dropped", cls: "" };
  if (sp.blocked) return { text: "Missing copy", cls: "stop" };
  if (sp.mode === "photo") return { text: "Photo slide", cls: "ok" };
  if (sp.mode === "brand") return { text: "Plain brand slide", cls: "warn" };
  return { text: "Text-slide fallback", cls: "warn" };
}

export default function Builder({ id }: { id: number }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null);
  const [picker, setPicker] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | "lib" | null>(null);
  const [exported, setExported] = useState<ExportResult | null>(null);
  const [exportReasons, setExportReasons] = useState<string[] | null>(null);

  const say = useCallback((text: string, err = false) => {
    setToast({ text, err });
    window.setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), err ? 7000 : 3200);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/carousels/${id}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not load this carousel.");
      setDetail(j);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (body: unknown): Promise<boolean> => {
      setBusy(true);
      try {
        const r = await fetch(`/api/carousels/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) {
          say(j.error ?? "That change was not saved.", true);
          return false;
        }
        setDetail(j);
        setExported(null);
        setExportReasons(null);
        return true;
      } catch {
        say("That change was not saved — is the app still running?", true);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [id, say],
  );

  const patchSlide = useCallback(
    (n: number, p: Record<string, unknown>) => patch({ slide: n, patch: p }),
    [patch],
  );

  const upload = useCallback(
    async (files: FileList | File[], assignTo: number | null) => {
      const list = Array.from(files);
      if (!list.length) return;
      if (assignTo !== null && list.length > 1) {
        say("One photo per slot. Drop several photos on the library instead.", true);
        return;
      }
      setBusy(true);
      try {
        const form = new FormData();
        list.forEach((f) => form.append("photos", f, f.name));
        const r = await fetch("/api/photos", { method: "POST", body: form });
        const j = await r.json();
        const rejected: { filename: string; reason: string }[] = j.rejected ?? [];
        if (rejected.length) say(rejected.map((x) => x.reason).join(" "), true);
        else if (!r.ok) say(j.error ?? "Upload failed.", true);
        const saved: PhotoInfo[] = j.saved ?? [];
        if (assignTo !== null && saved.length === 1) {
          await patchSlide(assignTo, { photo_filename: saved[0].filename });
          setSelected(assignTo);
        } else {
          await load();
          if (saved.length && !rejected.length) say(`${saved.length} photo${saved.length === 1 ? "" : "s"} added to the library.`);
        }
      } catch {
        say("Upload failed — is the app still running?", true);
      } finally {
        setBusy(false);
      }
    },
    [load, patchSlide, say],
  );

  const doExport = async () => {
    setBusy(true);
    setExportReasons(null);
    try {
      const r = await fetch(`/api/carousels/${id}/export`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        setExported(null);
        setExportReasons(j.reasons ?? [j.error ?? "Export failed."]);
        say("Export blocked — see the export check.", true);
      } else {
        setExported(j);
        say(`Exported ${j.files.filter((f: string) => f.endsWith(".jpg")).length} slides to ${j.folder_name}/`);
      }
    } catch {
      say("Export failed — is the app still running?", true);
    } finally {
      setBusy(false);
    }
  };

  const doCanva = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/carousels/${id}/canva`, { method: "POST" });
      if (!r.ok) {
        const j = await r.json();
        setExportReasons(j.reasons ?? [j.error ?? "Export failed."]);
        say("Canva CSV blocked — see the export check.", true);
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `carousel-${String(id).padStart(2, "0")}-canva-bulk-create.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      say("Canva Bulk Create CSV saved (also written to the export folder).");
    } finally {
      setBusy(false);
    }
  };

  const doMatch = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/carousels/${id}/match`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) return say(j.error ?? "Could not match.", true);
      await load();
      const m = j.matched.length;
      const miss = j.not_in_library.length;
      say(
        `${m} slot${m === 1 ? "" : "s"} filled from the selects map.` +
          (miss ? ` ${miss} recorded file${miss === 1 ? " is" : "s are"} not in the library yet.` : ""),
      );
    } finally {
      setBusy(false);
    }
  };

  const deletePhoto = async (filename: string) => {
    if (!window.confirm(`Remove ${filename} from the library on this machine?`)) return;
    const r = await fetch(`/api/photos/${encodeURIComponent(filename)}`, { method: "DELETE" });
    const j = await r.json();
    if (!r.ok) return say(j.error ?? "Could not remove that photo.", true);
    await load();
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      say(`${label} copied.`);
    } catch {
      say("Could not copy — select the text and copy it by hand.", true);
    }
  };

  if (loadError) {
    return (
      <div className="callout stop">
        <h2>Could not open this carousel</h2>
        <p>{loadError}</p>
        <p style={{ marginTop: 8 }}><Link href="/">Back to all carousels</Link></p>
      </div>
    );
  }
  if (!detail) return <p className="muted">Loading…</p>;

  const { carousel, plan, state, settings, photos } = detail;
  const parsed = carousel.parsed;
  const head = (
    <div className="page-head">
      <Link href="/" className="small">← All carousels</Link>
      <div className="row">
        <h1>
          <span className="muted">Carousel {carousel.id}</span> {carousel.title}
        </h1>
      </div>
      <div className="row small muted">
        {carousel.source_file ? <span>Source: <code>{carousel.source_file}</code></span> : <span>No build-ready file</span>}
        {parsed?.pairs_with && carousel.status !== "blocked" ? <span>· Pairs with {parsed.pairs_with}</span> : null}
        {parsed && carousel.status !== "blocked" ? <span>· {parsed.slides.length} slides in the file</span> : null}
      </div>
    </div>
  );

  if (carousel.status === "blocked") {
    return (
      <>
        {head}
        <div className="callout stop">
          <h2>Blocked — this carousel cannot be built or exported yet</h2>
          <p>{carousel.blocked_reason}</p>
          <p style={{ marginTop: 8 }} className="small">
            There is no way to build it from other photos or other copy in this app. When the missing
            input exists, write the build-ready file and update <code>carousel-registry.json</code>.
          </p>
        </div>
      </>
    );
  }

  if (!parsed || carousel.status === "source_missing" || carousel.status === "source_error") {
    return (
      <>
        {head}
        <div className="callout stop">
          <h2>{carousel.status === "source_missing" ? "Source file missing" : "The source file could not be read as expected"}</h2>
          {carousel.errors.length ? (
            <ul>{carousel.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          ) : (
            <p>{carousel.status_reason}</p>
          )}
          <p style={{ marginTop: 8 }} className="small">
            {carousel.status === "source_missing"
              ? "Copy the build-ready file into the content folder and reload. The app does not write this copy itself."
              : "Fix the Markdown file and reload. The app does not skip slides or fill in copy."}
          </p>
        </div>
      </>
    );
  }

  const selectedPlan = plan.slides.find((s) => s.number === selected) ?? plan.slides[0];
  const usedBy = new Map<string, number[]>();
  for (const sp of plan.slides) {
    if (sp.photo_assigned) usedBy.set(sp.photo_assigned, [...(usedBy.get(sp.photo_assigned) ?? []), sp.number]);
  }
  const recorded = Object.entries(detail.recorded_selects);
  const unconfirmedAges = plan.age_occurrences;

  return (
    <>
      {head}

      {carousel.note && <div className="callout info" style={{ marginBottom: 14 }}>{carousel.note}</div>}
      {carousel.status === "missing_copy" && (
        <div className="callout stop" style={{ marginBottom: 14 }}>
          <h3>Missing copy</h3>
          <p>{carousel.status_reason}</p>
        </div>
      )}

      <div className="build">
        <div>
          {parsed.slides.map((s) => {
            const sp = plan.slides.find((x) => x.number === s.number)!;
            return (
              <SlotCard
                key={s.number}
                carouselId={carousel.id}
                slide={s}
                sp={sp}
                st={(state.slides[String(s.number)] as SlideState | undefined) ?? null}
                photo={sp.photo_assigned ? photos.find((p) => p.filename === sp.photo_assigned) ?? null : null}
                sig={slideSig(sp, cropOf(state, s.number), settings)}
                selected={selectedPlan?.number === s.number}
                dragOver={dragOver === s.number}
                lockedNote={carousel.locked_note}
                busy={busy}
                onSelect={() => setSelected(s.number)}
                onPatch={(p) => patchSlide(s.number, p)}
                onPick={() => setPicker(s.number)}
                onUpload={(files) => upload(files, s.number)}
                onDragState={(over) => setDragOver(over ? s.number : null)}
              />
            );
          })}

          <section className="panel" style={{ marginTop: 14 }}>
            <h2>Selects library</h2>
            <div className="stack">
              <div
                className={`dropzone ${dragOver === "lib" ? "dragover" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver("lib"); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => { e.preventDefault(); setDragOver(null); upload(e.dataTransfer.files, null); }}
              >
                <p>Drop the real stills here, or</p>
                <label className="btn" style={{ marginTop: 8 }}>
                  Choose photos
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp,image/tiff" multiple hidden
                    onChange={(e) => { if (e.target.files) upload(e.target.files, null); e.target.value = ""; }}
                  />
                </label>
                <p className="hint" style={{ marginTop: 8 }}>
                  JPG, PNG, WebP or TIFF stills. Files keep their exact names and stay on this machine.
                  The app never picks a photo for a slot — you assign each one.
                </p>
              </div>

              {recorded.length > 0 && (
                <div className="callout info">
                  <div className="row">
                    <p className="grow small">
                      A selects map records file names for {recorded.length} slot{recorded.length === 1 ? "" : "s"} of this
                      carousel ({recorded.map(([n, f]) => `slide ${n}: ${f}`).join("; ")}). Empty slots can be filled
                      from it — exact file-name matches only.
                    </p>
                    <button className="btn small" onClick={doMatch} disabled={busy}>Fill from selects map</button>
                  </div>
                </div>
              )}

              {photos.length === 0 ? (
                <p className="muted small">
                  The library is empty. Until photos are assigned, every slide exports as its text-slide fallback.
                </p>
              ) : (
                <div className="lib-grid">
                  {photos.map((p) => (
                    <div className="lib-item" key={p.filename}>
                      <button
                        className="pick"
                        title={`Assign to slide ${selectedPlan.number}`}
                        onClick={() => patchSlide(selectedPlan.number, { photo_filename: p.filename })}
                        disabled={busy}
                      >
                        <img src={`/api/photos/${encodeURIComponent(p.filename)}?w=264`} alt="" loading="lazy" />
                      </button>
                      <div className="cap">
                        <span className="mono">{p.filename}</span>
                        <span className="muted">{p.width} × {p.height}</span>
                        {usedBy.has(p.filename) ? (
                          <span className="muted">In slide {usedBy.get(p.filename)!.join(", ")}</span>
                        ) : (
                          <button className="btn small danger" onClick={() => deletePhoto(p.filename)}>Remove</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {photos.length > 0 && (
                <p className="hint">Click a photo to assign it to the selected slide (slide {selectedPlan.number}).</p>
              )}
            </div>
          </section>
        </div>

        <aside className="side">
          <section className="panel">
            <h2>Live preview — slide {selectedPlan.number}</h2>
            <Preview
              key={`${selectedPlan.number}-${selectedPlan.photo_used ?? "none"}`}
              carouselId={carousel.id}
              sp={selectedPlan}
              crop={cropOf(state, selectedPlan.number)}
              photo={selectedPlan.photo_used ? photos.find((p) => p.filename === selectedPlan.photo_used) ?? null : null}
              sig={slideSig(selectedPlan, cropOf(state, selectedPlan.number), settings)}
              onSave={(c) => patchSlide(selectedPlan.number, { crop: c })}
            />
          </section>

          <section className="panel">
            <h2>Export</h2>
            <div className="stack">
              <ul className="checklist">
                {plan.errors.map((e, i) => <li className="err" key={`e${i}`}>{e}</li>)}
                {plan.errors.length === 0 && <li className="good">Export check passed.</li>}
              </ul>

              {unconfirmedAges.length > 0 && (
                <div className="callout warn">
                  <h3>&ldquo;Years old&rdquo; line — confirmation needed</h3>
                  <p className="small">
                    The &ldquo;22 years old&rdquo; line is [VERIFY] for the Reel 1 job only and must not be reused.
                    Any age in carousel text needs your explicit confirmation before export.
                  </p>
                  {unconfirmedAges.map((a) => (
                    <label className="check" key={a.key} style={{ marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={a.confirmed}
                        disabled={busy}
                        onChange={(e) => patch({ confirm_age: { key: a.key, confirmed: e.target.checked } })}
                      />
                      <span>
                        {a.where}: &ldquo;{a.match}&rdquo; — I confirm this age is a verified fact for the job this
                        carousel is about{a.reel1_line ? ", and it is not the Reel 1 line reused" : ""}.
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <button className="btn primary block" onClick={doExport} disabled={busy || !plan.exportable}>
                Export carousel
              </button>
              <p className="hint">
                Writes {plan.slides.filter((s) => !s.dropped).length} JPGs (1080 × 1350, quality 90), caption.txt,
                gbp.txt, manifest.json and selects-map.md to <code>{detail.export_folder}/</code>. Posting stays
                manual — paste the caption from caption.txt.
              </p>

              {plan.notices.length > 0 && (
                <details open={plan.notices.length <= 4}>
                  <summary>What this export will do ({plan.notices.length})</summary>
                  <ul className="checklist" style={{ marginTop: 8 }}>
                    {plan.notices.map((n, i) => <li className="info" key={i}>{n}</li>)}
                  </ul>
                </details>
              )}

              {exportReasons && (
                <div className="callout stop">
                  <h3>Export blocked</h3>
                  <ul>{exportReasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
              {exported && (
                <div className="callout info">
                  <h3>Exported</h3>
                  <p className="small mono" style={{ overflowWrap: "anywhere" }}>{exported.folder}</p>
                  <ul className="small">{exported.files.map((f) => <li key={f} className="mono">{f}</li>)}</ul>
                </div>
              )}

              <details>
                <summary>Other exports</summary>
                <div className="stack" style={{ marginTop: 10 }}>
                  <div>
                    <a className="btn small" href={`/api/carousels/${carousel.id}/selects-map`}>Selects map (tick sheet)</a>
                    <p className="hint" style={{ marginTop: 4 }}>
                      The slot-by-slot tick sheet as it stands now. The export writes the final one.
                    </p>
                  </div>
                  <div>
                    <button className="btn small" onClick={doCanva} disabled={busy || !plan.exportable}>
                      Canva Bulk Create CSV
                    </button>
                    <p className="hint" style={{ marginTop: 4 }}>
                      Fallback for the existing Canva workflow — not a second builder. Bulk Create is a paid Canva
                      Pro feature, desktop only. Images must be embedded in the spreadsheet or already in the Canva
                      library; image URLs do not work, so the CSV carries file names only.
                    </p>
                  </div>
                </div>
              </details>
            </div>
          </section>

          <section className="panel">
            <h2>Caption, hashtags, GBP line</h2>
            <div className="stack">
              <CopyBlock label="Caption" text={parsed.caption} onCopy={copy} />
              <CopyBlock label="Hashtags" text={parsed.hashtags} onCopy={copy} />
              <CopyBlock label="GBP line" text={parsed.gbp_line} onCopy={copy} />
              <p className="hint">
                Read from the source file, word for word. One carousel a week also becomes the weekly GBP post —
                copy the line; it is never auto-posted.
              </p>
            </div>
          </section>

          <section className="panel">
            <h2>CRM job</h2>
            <div className="stack">
              <p className="small">Job ID: <span className="mono">{state.job_id ?? parsed.job_id ?? "none"}</span></p>
              <button className="btn" disabled title="CRM not connected yet">Seed from CRM job</button>
              <p className="hint">CRM not connected yet.</p>
            </div>
          </section>
        </aside>
      </div>

      {picker !== null && (
        <div className="modal-back" onClick={() => setPicker(null)}>
          <div className="modal" role="dialog" aria-label={`Pick a photo for slide ${picker}`} onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 12 }}>
              <h2 className="grow">Pick a photo for slide {picker}</h2>
              <button className="btn small" onClick={() => setPicker(null)}>Close</button>
            </div>
            {photos.length === 0 ? (
              <p className="muted">The library is empty. Upload the stills first.</p>
            ) : (
              <div className="lib-grid">
                {photos.map((p) => (
                  <div className="lib-item" key={p.filename}>
                    <button
                      className="pick"
                      onClick={async () => {
                        const n = picker;
                        setPicker(null);
                        if (await patchSlide(n, { photo_filename: p.filename })) setSelected(n);
                      }}
                    >
                      <img src={`/api/photos/${encodeURIComponent(p.filename)}?w=264`} alt="" loading="lazy" />
                    </button>
                    <div className="cap">
                      <span className="mono">{p.filename}</span>
                      <span className="muted">{p.width} × {p.height}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.err ? "err" : ""}`} role="status">{toast.text}</div>}
    </>
  );
}

function CopyBlock({
  label,
  text,
  onCopy,
}: {
  label: string;
  text: string | null;
  onCopy: (label: string, text: string) => void;
}) {
  return (
    <div>
      <div className="row" style={{ marginBottom: 4 }}>
        <h3 className="grow">{label}</h3>
        <button className="btn small" disabled={!text} onClick={() => text && onCopy(label, text)}>Copy</button>
      </div>
      <div className="copybox">{text ?? "Not in the source file."}</div>
    </div>
  );
}

function SlotCard(props: {
  carouselId: number;
  slide: ParsedSlide;
  sp: SlidePlan;
  st: SlideState | null;
  photo: PhotoInfo | null;
  sig: string;
  selected: boolean;
  dragOver: boolean;
  lockedNote: string | null;
  busy: boolean;
  onSelect: () => void;
  onPatch: (p: Record<string, unknown>) => Promise<boolean>;
  onPick: () => void;
  onUpload: (files: FileList) => void;
  onDragState: (over: boolean) => void;
}) {
  const { slide: s, sp, st, photo, busy } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ml = modeLabel(sp);
  const permission: Permission = sp.permission;

  return (
    <article
      className={`slot ${props.selected ? "selected" : ""} ${props.dragOver ? "dragover" : ""} ${sp.dropped ? "dropped" : ""}`}
      onDragOver={(e) => { e.preventDefault(); props.onDragState(true); }}
      onDragLeave={() => props.onDragState(false)}
      onDrop={(e) => {
        e.preventDefault();
        props.onDragState(false);
        if (e.dataTransfer.files.length) props.onUpload(e.dataTransfer.files);
      }}
    >
      {sp.text ? (
        <button className="thumb" onClick={props.onSelect} aria-label={`Preview slide ${s.number}`}>
          <img src={`/api/render/${props.carouselId}/${s.number}?w=224&v=${props.sig}`} alt="" />
        </button>
      ) : (
        <div className="thumb empty">No preview — missing copy</div>
      )}

      <div>
        <div className="slot-head">
          <h3>Slide {s.number}{s.label ? ` — ${s.label}` : ""}</h3>
          <span className={`chip ${ml.cls}`}>{ml.text}</span>
          {sp.is_cta && <span className="chip">CTA slide</span>}
          {sp.edited_from_source && <span className="chip warn">Edited from source file</span>}
          {sp.export_index !== null && sp.export_index !== s.number && (
            <span className="chip">Exports as slide {sp.export_index}</span>
          )}
        </div>

        <dl className="kv">
          <dt>Photo needed</dt>
          <dd>{s.photo_needed ?? <span className="muted">Not stated in the source file</span>}</dd>
          <dt>On-screen text</dt>
          <dd>
            {sp.text ? (
              <span className="copytext">{sp.text}</span>
            ) : (
              <span className="note stop">{s.blocked}</span>
            )}
          </dd>
          {s.small_line && (
            <>
              <dt>Small line</dt>
              <dd><span className="copytext small-line">{s.small_line}</span></dd>
            </>
          )}
          <dt>Fallback</dt>
          <dd>{s.fallback_text ?? "Plain text slide, same words, no photo"}</dd>
          <dt>Photo</dt>
          <dd>
            {sp.photo_assigned ? (
              <span className="mono">{sp.photo_assigned}</span>
            ) : (
              <span className="muted">No photo</span>
            )}
            {photo ? <span className="muted small"> · {photo.width} × {photo.height}</span> : null}
          </dd>
        </dl>

        {!sp.dropped && sp.fallback_reason && sp.text && (
          <p className={`note ${sp.photo_assigned ? "stop" : ""}`} style={{ marginTop: 8 }}>
            Exports as {sp.mode === "brand" ? "a plain brand slide" : "the text slide"} — {sp.fallback_reason}.
          </p>
        )}
        {sp.errors.map((e, i) => <p className="note stop" key={i} style={{ marginTop: 6 }}>{e}</p>)}

        {!sp.dropped && (
          <div className="slot-section">
            <div className="row">
              <label className="btn small">
                {sp.photo_assigned ? "Replace photo" : "Upload photo"}
                <input
                  type="file" accept="image/jpeg,image/png,image/webp,image/tiff" hidden
                  onChange={(e) => { if (e.target.files?.length) props.onUpload(e.target.files); e.target.value = ""; }}
                />
              </label>
              <button className="btn small" onClick={props.onPick} disabled={busy}>Pick from library</button>
              {sp.photo_assigned && (
                <button className="btn small danger" onClick={() => props.onPatch({ photo_filename: null })} disabled={busy}>
                  Remove photo
                </button>
              )}
              <span className="hint">or drop a photo on this card</span>
            </div>

            {sp.natural_moment_only && (
              <div className="callout info small">
                Use a photo here only if a natural, unstaged moment exists from the shoot. Otherwise keep the
                text slide or drop the slide — do not stage one.
                {sp.photo_assigned && (
                  <label className="check" style={{ marginTop: 6 }}>
                    <input
                      type="checkbox" checked={!!st?.natural_confirmed} disabled={busy}
                      onChange={(e) => props.onPatch({ natural_confirmed: e.target.checked })}
                    />
                    <span>This photo is a natural, unstaged moment from the shoot.</span>
                  </label>
                )}
              </div>
            )}

            {sp.photo_assigned && (
              <>
                <div className="row">
                  <span className="small">Inside-home photo?</span>
                  <div className="seg" role="group" aria-label="Inside-home photo">
                    <button aria-pressed={sp.permission_required} disabled={busy} onClick={() => props.onPatch({ inside_home: true })}>Yes</button>
                    <button aria-pressed={!sp.permission_required} disabled={busy} onClick={() => props.onPatch({ inside_home: false })}>No</button>
                  </div>
                  <span className="hint">{sp.permission_basis}</span>
                </div>
                {sp.permission_required && (
                  <div className="row">
                    <span className="small">Homeowner permission</span>
                    <div className="seg" role="group" aria-label="Homeowner permission">
                      <button className="y" aria-pressed={permission === "Y"} disabled={busy} onClick={() => props.onPatch({ permission: "Y" })}>Y</button>
                      <button className="n" aria-pressed={permission === "N"} disabled={busy} onClick={() => props.onPatch({ permission: "N" })}>N</button>
                      <button aria-pressed={permission === "unconfirmed"} disabled={busy} onClick={() => props.onPatch({ permission: "unconfirmed" })}>Unconfirmed</button>
                    </div>
                    {permission === "Y" ? (
                      <span className="note ok">Photo can be used.</span>
                    ) : (
                      <span className="note stop">Photo blocked until permission is Y.</span>
                    )}
                  </div>
                )}
              </>
            )}

            {sp.upscale && (
              <label className="check">
                <input
                  type="checkbox" checked={sp.upscale.acknowledged} disabled={busy}
                  onChange={(e) => props.onPatch({ upscale_ack: e.target.checked })}
                />
                <span className="note warn">
                  This photo is smaller than the frame and would be enlarged {Math.round((sp.upscale.factor - 1) * 100)}%
                  past its native resolution. Use anyway.
                </span>
              </label>
            )}
          </div>
        )}

        {sp.droppable && (
          <div className="slot-section">
            <label className="check">
              <input
                type="checkbox" checked={sp.dropped} disabled={busy}
                onChange={(e) => props.onPatch({ dropped: e.target.checked })}
              />
              <span>Drop this slide <span className="hint">— it is left out and the export is renumbered.</span></span>
            </label>
          </div>
        )}

        {!sp.dropped && sp.source_text && (
          <div className="slot-section">
            {sp.locked ? (
              <p className="hint">{props.lockedNote ?? "This slide's text is locked."}</p>
            ) : editing ? (
              <div className="stack">
                <label className="field">
                  Edit on-screen text
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
                  <span className="hint">
                    Saved with an &ldquo;Edited from source file&rdquo; flag; old and new text go in the manifest. The
                    Markdown file is not changed. No prices, percentages or ages.
                  </span>
                </label>
                <div className="row">
                  <button
                    className="btn small primary" disabled={busy}
                    onClick={async () => { if (await props.onPatch({ override_text: draft })) setEditing(false); }}
                  >
                    Save as edited from source file
                  </button>
                  <button className="btn small" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            ) : sp.edited_from_source ? (
              <div className="stack">
                <p className="note warn">
                  Edited from source file. Source text: <span style={{ whiteSpace: "pre-line" }}>&ldquo;{sp.source_text}&rdquo;</span>
                </p>
                <div className="row">
                  <button className="btn small" onClick={() => { setDraft(sp.text ?? ""); setEditing(true); }}>Edit again</button>
                  <button className="btn small" disabled={busy} onClick={() => props.onPatch({ override_text: null })}>Back to source text</button>
                </div>
              </div>
            ) : (
              <div className="row">
                <button className="btn small" onClick={() => { setDraft(sp.text ?? ""); setEditing(true); }}>Edit text…</button>
                <span className="hint">Read-only from the source file by default.</span>
              </div>
            )}
          </div>
        )}

        {(s.extras.length > 0 || s.warnings.length > 0) && (
          <details style={{ marginTop: 10 }}>
            <summary>Other lines in the file for this slide</summary>
            <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {s.extras.map((x, i) => <li key={`x${i}`}><strong>{x.label}:</strong> {x.value}</li>)}
              {s.warnings.map((w, i) => <li key={`w${i}`} className="muted">{w}</li>)}
            </ul>
          </details>
        )}
      </div>
    </article>
  );
}

function Preview({
  carouselId,
  sp,
  crop,
  photo,
  sig,
  onSave,
}: {
  carouselId: number;
  sp: SlidePlan;
  crop: Crop;
  photo: PhotoInfo | null;
  sig: string;
  onSave: (c: Crop) => void;
}) {
  // While dragging, the preview is re-rendered by the server with the crop in
  // the URL, so what you see is always the real export pixels.
  const [live, setLive] = useState<Crop>(crop);
  const [shown, setShown] = useState<Crop>(crop);
  const [dragging, setDragging] = useState(false);
  const loading = useRef(false);
  const latest = useRef<Crop>(crop);
  const start = useRef<{ px: number; py: number; crop: Crop; w: number } | null>(null);

  useEffect(() => {
    setLive(crop);
    setShown(crop);
    latest.current = crop;
  }, [crop.x, crop.y, crop.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  const request = useCallback((c: Crop) => {
    latest.current = c;
    setLive(c);
    if (!loading.current) {
      loading.current = true;
      setShown(c);
    }
  }, []);

  const canMove = !!photo && sp.mode === "photo";
  const slack = useMemo(() => {
    if (!photo) return { x: 0, y: 0 };
    const scale = Math.max(W / photo.width, H / photo.height) * live.zoom;
    return { x: photo.width * scale - W, y: photo.height * scale - H };
  }, [photo, live.zoom]);

  const src =
    `/api/render/${carouselId}/${sp.number}?x=${shown.x.toFixed(4)}&y=${shown.y.toFixed(4)}` +
    `&zoom=${shown.zoom.toFixed(3)}&w=760&v=${sig}`;

  if (!sp.text) {
    return <div className="callout stop">{sp.blocked}</div>;
  }

  return (
    <div className="stack">
      <div
        className={`preview-frame ${canMove ? "draggable" : ""} ${dragging ? "dragging" : ""}`}
        onPointerDown={(e) => {
          if (!canMove) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          start.current = { px: e.clientX, py: e.clientY, crop: live, w: e.currentTarget.clientWidth };
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const k = W / s.w;
          const dx = (e.clientX - s.px) * k;
          const dy = (e.clientY - s.py) * k;
          const clamp = (v: number) => Math.min(1, Math.max(0, v));
          request({
            zoom: s.crop.zoom,
            x: slack.x > 1 ? clamp(s.crop.x - dx / slack.x) : s.crop.x,
            y: slack.y > 1 ? clamp(s.crop.y - dy / slack.y) : s.crop.y,
          });
        }}
        onPointerUp={() => {
          if (!start.current) return;
          start.current = null;
          setDragging(false);
          onSave(latest.current);
        }}
        onPointerCancel={() => { start.current = null; setDragging(false); }}
      >
        <img
          src={src}
          alt={`Slide ${sp.number} as it will export`}
          onLoad={() => {
            loading.current = false;
            const l = latest.current;
            if (l.x !== shown.x || l.y !== shown.y || l.zoom !== shown.zoom) {
              loading.current = true;
              setShown(l);
            }
          }}
          onError={() => { loading.current = false; }}
        />
      </div>
      <p className="hint">
        {sp.dropped ? "Dropped — shown for reference, not exported. " : ""}
        Rendered by the export engine at 1080 × 1350, so this is the slide as it will export.
        {canMove ? " Drag the photo to reposition it." : ""}
      </p>
      {canMove && (
        <div className="row">
          <label className="small" htmlFor="zoom">Zoom</label>
          <input
            id="zoom" type="range" min={1} max={3} step={0.01} value={live.zoom} className="grow"
            onChange={(e) => request({ ...live, zoom: Number(e.target.value) })}
            onPointerUp={() => onSave(latest.current)}
            onKeyUp={() => onSave(latest.current)}
          />
          <button className="btn small" onClick={() => { request(DEFAULT_CROP); onSave(DEFAULT_CROP); }}>Centre</button>
        </div>
      )}
    </div>
  );
}
