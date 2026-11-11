"use client";

import { useEffect, useState } from "react";
import type { Settings } from "@/lib/types";

interface Sample {
  id: number;
  first: number;
  last: number;
}

export default function SettingsForm() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [townsText, setTownsText] = useState("");
  const [sample, setSample] = useState<Sample | null>(null);
  const [rev, setRev] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const j = await r.json();
      setS(j.settings);
      setSaved(j.settings);
      setTownsText(j.settings.towns.join("\n"));
      const lr = await fetch("/api/carousels", { cache: "no-store" });
      const lj = await lr.json();
      const ready = (lj.carousels as { id: number; status: string; slide_count: number | null }[]).find(
        (c) => c.status === "ready" && c.slide_count,
      );
      if (ready) setSample({ id: ready.id, first: 1, last: ready.slide_count! });
    })();
  }, []);

  if (!s) return <p className="muted">Loading…</p>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const dirty = JSON.stringify({ ...s, towns: townsText.split("\n").map((t) => t.trim()).filter(Boolean) }) !== JSON.stringify(saved);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...s, towns: townsText.split("\n") }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error ?? "Not saved.");
    setS(j.settings);
    setSaved(j.settings);
    setTownsText(j.settings.towns.join("\n"));
    setRev((n) => n + 1);
    setMsg("Saved. Every carousel now renders with these settings.");
  };

  return (
    <form onSubmit={save}>
      <div className="page-head">
        <h1>Template settings</h1>
        <p className="lede">
          One template for every carousel, set in one place. Nothing here is invented: the brand font,
          template colour and business name are placeholders until you fill them in.
        </p>
      </div>

      <div className="settings-grid">
        <div>
          <section className="panel">
            <h2>Text</h2>
            <div className="form-grid">
              <label className="field full">
                Font family
                <input
                  type="text" value={s.font_family} placeholder="System sans (default)"
                  onChange={(e) => set("font_family", e.target.value)}
                />
                <span className="hint">
                  Leave empty for a clean system sans. If there is a brand font, type its exact name — it
                  must be installed on this machine, otherwise the system sans is used.
                </span>
              </label>
              <label className="field">
                Text size (px on the 1080 × 1350 slide)
                <input type="number" min={32} max={120} value={s.text_size} onChange={(e) => set("text_size", Number(e.target.value))} />
                <span className="hint">The small line is set at 55% of this.</span>
              </label>
              <label className="field">
                Text position
                <input type="text" value="Bottom strip (as in the manual Canva build)" readOnly disabled />
                <span className="hint">Same position on every slide.</span>
              </label>
              <label className="field">
                Bottom margin (px)
                <input type="number" min={40} max={400} value={s.text_bottom_margin} onChange={(e) => set("text_bottom_margin", Number(e.target.value))} />
              </label>
              <label className="field">
                Overlay opacity ({Math.round(s.overlay_opacity * 100)}%)
                <input type="range" min={0} max={1} step={0.05} value={s.overlay_opacity} onChange={(e) => set("overlay_opacity", Number(e.target.value))} />
                <span className="hint">Dark gradient behind the text on photo slides.</span>
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>Text slides and brand slide</h2>
            <div className="form-grid">
              <label className="field">
                Template colour
                <div className="row">
                  <input type="color" value={s.template_colour} onChange={(e) => set("template_colour", e.target.value)} style={{ width: 48, height: 34, padding: 2 }} />
                  <span className="mono">{s.template_colour}</span>
                </div>
                <span className="hint">
                  Background of text-slide fallbacks and the brand slide. The default is a neutral
                  placeholder, not a brand colour.
                </span>
              </label>
              <label className="field">
                Business name
                <input
                  type="text" value={s.business_name} placeholder="[PLACEHOLDER — not set]"
                  onChange={(e) => set("business_name", e.target.value)}
                />
                <span className="hint">
                  Shown on the plain brand slide. Until it is set, a carousel whose last slide falls back
                  to a brand slide cannot export.
                </span>
              </label>
              <label className="field full">
                Brand-slide text <span className="hint">optional extra line under the business name</span>
                <input type="text" value={s.brand_slide_text} onChange={(e) => set("brand_slide_text", e.target.value)} />
              </label>
              <label className="field full">
                Towns <span className="hint">one per line, shown on the brand slide</span>
                <textarea rows={4} value={townsText} onChange={(e) => setTownsText(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="panel">
            <h2>Export</h2>
            <p className="small">
              Fixed for every slide: <strong>1080 × 1350 px</strong> (4:5 portrait), <strong>JPG quality 90</strong>.
            </p>
            <p className="hint" style={{ marginTop: 6 }}>
              No API keys, no cloud storage, no logins. Photos, settings and exports stay on this machine.
            </p>
          </section>

          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary" type="submit" disabled={!dirty}>Save settings</button>
            {msg && <span className="note ok" role="status">{msg}</span>}
          </div>
        </div>

        <aside className="panel">
          <h2>Preview</h2>
          {sample ? (
            <div className="stack">
              <div className="preview-frame">
                <img src={`/api/render/${sample.id}/${sample.first}?w=640&v=${rev}`} alt="First slide with saved settings" />
              </div>
              <div className="preview-frame">
                <img src={`/api/render/${sample.id}/${sample.last}?w=640&v=${rev}`} alt="Last slide with saved settings" />
              </div>
              <p className="hint">
                Carousel {sample.id}, first and last slide, with the saved settings. Save to refresh.
              </p>
            </div>
          ) : (
            <p className="muted small">
              No carousel copy is loaded yet, so there is nothing to preview. A preview appears once a
              build-ready file is in <code>content/</code>.
            </p>
          )}
        </aside>
      </div>
    </form>
  );
}
