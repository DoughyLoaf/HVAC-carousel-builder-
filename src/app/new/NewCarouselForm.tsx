"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface SlideDraft {
  photo_needed: string;
  on_screen_text: string;
  small_line: string;
  fallback_text: string;
  inside_home: boolean;
}

const FALLBACK = "plain text slide, same words, no photo";
const blankSlide = (): SlideDraft => ({
  photo_needed: "",
  on_screen_text: "",
  small_line: "",
  fallback_text: FALLBACK,
  inside_home: true,
});

export default function NewCarouselForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pairsWith, setPairsWith] = useState("");
  const [slides, setSlides] = useState<SlideDraft[]>(() => Array.from({ length: 6 }, blankSlide));
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [gbp, setGbp] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const setCount = (n: number) =>
    setSlides((cur) =>
      n > cur.length ? [...cur, ...Array.from({ length: n - cur.length }, blankSlide)] : cur.slice(0, n),
    );
  const update = (i: number, p: Partial<SlideDraft>) =>
    setSlides((cur) => cur.map((s, j) => (j === i ? { ...s, ...p } : s)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProblems([]);
    try {
      const r = await fetch("/api/carousels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, pairs_with: pairsWith, slides, caption, hashtags, gbp_line: gbp }),
      });
      const j = await r.json();
      if (!r.ok) {
        setProblems(j.problems ?? [j.error ?? "Could not save."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push(`/carousel/${j.id}`);
    } catch {
      setProblems(["Could not save — is the app still running?"]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <div className="page-head">
        <Link href="/" className="small">← All carousels</Link>
        <h1>New carousel</h1>
        <p className="lede">
          For Shoot 2 or a future job. Same template, same gates. It is saved as a build-ready Markdown file
          in <code>content/new/</code>, in the same format as the Shoot 1 files.
        </p>
      </div>

      {problems.length > 0 && (
        <div className="callout stop" style={{ marginBottom: 14 }} role="alert">
          <h2>Not saved yet</h2>
          <ul>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}

      <div className="callout info" style={{ marginBottom: 14 }}>
        <h3>Same rules as every carousel</h3>
        <ul>
          <li>You type every word. The app does not write or suggest copy, prices, ages, costs or failure rates.</li>
          <li>No prices. No invented job facts — only what is true for this job.</li>
          <li>One CTA per carousel, on the last slide.</li>
          <li>Eric Ayden featured; Eddie sparingly.</li>
          <li>Real photos from the shoot or job only. A slide with no photo exports as its text slide.</li>
        </ul>
      </div>

      <section className="panel">
        <h2>Carousel</h2>
        <div className="form-grid">
          <label className="field">
            Title
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field">
            Pairs with <span className="hint">optional — e.g. a reel from the same shoot</span>
            <input type="text" value={pairsWith} onChange={(e) => setPairsWith(e.target.value)} />
          </label>
          <label className="field">
            Number of slides <span className="hint">6–7 is the usual</span>
            <select value={slides.length} onChange={(e) => setCount(Number(e.target.value))}>
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div className="field">
            CRM job
            <div className="row">
              <button type="button" className="btn" disabled title="CRM not connected yet">Seed from CRM job</button>
              <span className="hint">CRM not connected yet.</span>
            </div>
          </div>
        </div>
      </section>

      {slides.map((s, i) => {
        const last = i === slides.length - 1;
        return (
          <section className="panel" key={i}>
            <h2>Slide {i + 1}{last ? " — CTA slide (the one CTA)" : ""}</h2>
            <div className="form-grid">
              <label className="field full">
                Photo needed
                <input type="text" value={s.photo_needed} onChange={(e) => update(i, { photo_needed: e.target.value })} required />
              </label>
              <label className="field">
                On-screen text <span className="hint">exact words; a new line here is a new line on the slide</span>
                <textarea value={s.on_screen_text} onChange={(e) => update(i, { on_screen_text: e.target.value })} rows={2} required />
              </label>
              <label className="field">
                Small line <span className="hint">optional, sits under the main line</span>
                <input type="text" value={s.small_line} onChange={(e) => update(i, { small_line: e.target.value })} />
              </label>
              <label className="field full">
                Fallback if there is no photo
                <input type="text" value={s.fallback_text} onChange={(e) => update(i, { fallback_text: e.target.value })} required />
                {last && (
                  <span className="hint">
                    For a plain brand slide (business name + this CTA text) instead of a text slide, write
                    &ldquo;plain brand slide&rdquo; here.
                  </span>
                )}
              </label>
              <label className="check full">
                <input type="checkbox" checked={s.inside_home} onChange={(e) => update(i, { inside_home: e.target.checked })} />
                <span>Photo is taken inside a home — needs homeowner permission before it can be used</span>
              </label>
            </div>
          </section>
        );
      })}

      <section className="panel">
        <h2>Caption, hashtags, GBP line</h2>
        <div className="form-grid">
          <label className="field full">
            Caption
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} required />
          </label>
          <label className="field full">
            Hashtags
            <textarea value={hashtags} onChange={(e) => setHashtags(e.target.value)} rows={2} required />
          </label>
          <label className="field full">
            GBP repurpose <span className="hint">one line, for the weekly GBP post</span>
            <input type="text" value={gbp} onChange={(e) => setGbp(e.target.value)} required />
          </label>
        </div>
      </section>

      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn primary" type="submit" disabled={saving}>Save carousel</button>
        <Link className="btn" href="/">Cancel</Link>
      </div>
    </form>
  );
}
