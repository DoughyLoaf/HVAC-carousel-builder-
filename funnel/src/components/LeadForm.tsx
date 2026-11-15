"use client";

import { useEffect, useId, useRef, useState } from "react";
import { captureTouch } from "@/lib/client/touch";
import { CallLink } from "./CallLink";
import { INTENT_EVENT } from "./IntentLink";

export interface LeadFormCopy {
  title: string;
  step1: string;
  step2: string;
  types: { id: string; title: string; blurb: string }[];
  urgency: { id: string; label: string }[];
  urgentNote: string;
  heard: string[];
  success: string;
  successBody: string;
}

interface Props {
  copy: LeadFormCopy;
  townGroups: { county: string; towns: string[] }[];
  phone: { display: string; tel: string } | null;
  consent: string;
  callLabel: string;
}

type Errors = Partial<Record<"request_type" | "name" | "phone" | "email" | "zip" | "form", string>>;
type Phase = "editing" | "sending" | "sent";

const OTHER_TOWN = "Somewhere else";

function formatPhoneTyping(raw: string): string {
  const d = raw.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function LeadForm({ copy, townGroups, phone, consent, callLabel }: Props) {
  const uid = useId();
  const [step, setStep] = useState<1 | 2>(1);
  const [phase, setPhase] = useState<Phase>("editing");
  const [errors, setErrors] = useState<Errors>({});
  const [ref, setRef] = useState("");
  const [v, setV] = useState({
    request_type: "", urgency: "", town: "", zip: "", name: "", phone: "", email: "",
    preferred_contact: "either", message: "", self_reported_source: "", company: "",
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof typeof v, value: string) => {
    setV((cur) => ({ ...cur, [key]: value }));
    // A message about a field goes away as soon as the person starts fixing it.
    setErrors((cur) => (key in cur || cur.form ? { ...cur, [key]: undefined, form: undefined } : cur));
  };

  useEffect(() => {
    captureTouch();
    const fromUrl = new URLSearchParams(window.location.search).get("intent");
    if (fromUrl && copy.types.some((t) => t.id === fromUrl)) set("request_type", fromUrl);
    const onIntent = (e: Event) => {
      const intent = (e as CustomEvent<string>).detail;
      if (copy.types.some((t) => t.id === intent)) {
        setV((cur) => ({ ...cur, request_type: intent }));
        setErrors({});
        setStep(1);
        setPhase((p) => (p === "sent" ? "editing" : p));
      }
    };
    window.addEventListener(INTENT_EVENT, onIntent);
    return () => window.removeEventListener(INTENT_EVENT, onIntent);
  }, [copy.types]);

  function next() {
    if (!v.request_type) {
      setErrors({ request_type: "Choose what you need." });
      return;
    }
    if (v.zip && !/^\d{5}$/.test(v.zip)) {
      setErrors({ zip: "ZIP codes are 5 digits." });
      return;
    }
    setErrors({});
    setStep(2);
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (phase === "sending") return;
    const local: Errors = {};
    if (v.name.trim().length < 2) local.name = "Tell us your name.";
    if (v.phone.replace(/\D/g, "").length !== 10) local.phone = "We need a 10-digit phone number to call or text you back.";
    if (Object.keys(local).length > 0) {
      setErrors(local);
      return;
    }
    setErrors({});
    setPhase("sending");
    try {
      const { last, first } = captureTouch();
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, town: v.town === OTHER_TOWN ? "" : v.town, last_touch: last, first_touch: first }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string; errors?: Errors; error?: string };
      if (res.ok && data.ok) {
        setRef(data.ref ?? "");
        setPhase("sent");
        requestAnimationFrame(() => headingRef.current?.focus());
        return;
      }
      if (data.errors) {
        setErrors(data.errors);
        if (data.errors.request_type || data.errors.zip) setStep(1);
      } else {
        setErrors({ form: data.error ?? "We couldn’t save your request. Please call us instead." });
      }
    } catch {
      setErrors({ form: "We couldn’t reach the server. Check your connection and try again, or call us." });
    }
    setPhase("editing");
  }

  if (phase === "sent") {
    return (
      <div className="form-card form-done" role="status">
        <div className="done-mark" aria-hidden="true">✓</div>
        <h2 ref={headingRef} tabIndex={-1}>{copy.success}</h2>
        <p>{copy.successBody}</p>
        {ref && <p className="done-ref">Reference <strong>{ref}</strong></p>}
        {phone && (
          <CallLink tel={phone.tel} placement="form-success" className="btn btn-call btn-block">
            {callLabel} · {phone.display}
          </CallLink>
        )}
      </div>
    );
  }

  const urgent = v.urgency === "urgent";

  return (
    <form className="form-card" onSubmit={submit} noValidate aria-labelledby={`${uid}-title`}>
      <div className="form-head">
        <h2 id={`${uid}-title`}>{copy.title}</h2>
        <div className="steps" aria-label={`Step ${step} of 2`}>
          <span className={step === 1 ? "step-dot on" : "step-dot done"}>1</span>
          <span className="step-line" data-on={step === 2} />
          <span className={step === 2 ? "step-dot on" : "step-dot"}>2</span>
        </div>
      </div>

      {/* Hidden from people; bots fill it in. */}
      <div className="hp" aria-hidden="true">
        <label>Company<input tabIndex={-1} autoComplete="off" value={v.company} onChange={(e) => set("company", e.target.value)} /></label>
      </div>

      {step === 1 && (
        <div className="form-step">
          <fieldset>
            <legend>{copy.step1}</legend>
            <div className="choices">
              {copy.types.map((t) => (
                <label key={t.id} className={v.request_type === t.id ? "choice on" : "choice"}>
                  <input type="radio" name="request_type" value={t.id} checked={v.request_type === t.id}
                    onChange={() => { set("request_type", t.id); setErrors({}); }} />
                  <span className="choice-title">{t.title}</span>
                  <span className="choice-blurb">{t.blurb}</span>
                </label>
              ))}
            </div>
            {errors.request_type && <p className="err" role="alert">{errors.request_type}</p>}
          </fieldset>

          <fieldset>
            <legend>How soon?</legend>
            <div className="chips">
              {copy.urgency.map((u) => (
                <label key={u.id} className={v.urgency === u.id ? "chip on" : "chip"}>
                  <input type="radio" name="urgency" value={u.id} checked={v.urgency === u.id} onChange={() => set("urgency", u.id)} />
                  {u.label}
                </label>
              ))}
            </div>
            {urgent && phone && (
              <div className="urgent-note" role="status">
                <p>{copy.urgentNote}</p>
                <CallLink tel={phone.tel} placement="form-urgent" className="btn btn-call btn-small">{callLabel} · {phone.display}</CallLink>
              </div>
            )}
          </fieldset>

          <div className="row">
            <label className="field grow">
              <span>Where’s the home?</span>
              <select value={v.town} onChange={(e) => set("town", e.target.value)}>
                <option value="">Choose a town</option>
                {townGroups.map((g) => (
                  <optgroup key={g.county} label={g.county}>
                    {g.towns.map((t) => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                ))}
                <option value={OTHER_TOWN}>{OTHER_TOWN}</option>
              </select>
            </label>
            <label className="field zip">
              <span>ZIP <em>(optional)</em></span>
              <input inputMode="numeric" autoComplete="postal-code" maxLength={5} value={v.zip}
                onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(errors.zip)} />
            </label>
          </div>
          {errors.zip && <p className="err" role="alert">{errors.zip}</p>}

          <button type="button" className="btn btn-primary btn-block" onClick={next}>Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="form-step">
          <p className="step-title">{copy.step2}</p>
          <label className="field">
            <span>Name</span>
            <input ref={nameRef} autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)}
              aria-invalid={Boolean(errors.name)} />
            {errors.name && <span className="err" role="alert">{errors.name}</span>}
          </label>
          <label className="field">
            <span>Phone</span>
            <input type="tel" inputMode="tel" autoComplete="tel" placeholder="(208) 555-0100" value={v.phone}
              onChange={(e) => set("phone", formatPhoneTyping(e.target.value))} aria-invalid={Boolean(errors.phone)} />
            {errors.phone && <span className="err" role="alert">{errors.phone}</span>}
          </label>
          <fieldset className="inline">
            <legend>Best way to reach you</legend>
            <div className="chips">
              {[["call", "Call"], ["text", "Text"], ["either", "Either"]].map(([id, label]) => (
                <label key={id} className={v.preferred_contact === id ? "chip on" : "chip"}>
                  <input type="radio" name="preferred_contact" value={id} checked={v.preferred_contact === id}
                    onChange={() => set("preferred_contact", id)} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>Email <em>(optional)</em></span>
            <input type="email" inputMode="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)}
              aria-invalid={Boolean(errors.email)} />
            {errors.email && <span className="err" role="alert">{errors.email}</span>}
          </label>
          <label className="field">
            <span>Anything we should know? <em>(optional)</em></span>
            <textarea rows={3} maxLength={2000} value={v.message} onChange={(e) => set("message", e.target.value)} />
          </label>
          <label className="field">
            <span>How did you hear about CDA? <em>(optional)</em></span>
            <select value={v.self_reported_source} onChange={(e) => set("self_reported_source", e.target.value)}>
              <option value="">Choose one</option>
              {copy.heard.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </label>

          {errors.form && (
            <div className="form-error" role="alert">
              <p>{errors.form}</p>
              {phone && <CallLink tel={phone.tel} placement="form-error" className="btn btn-call btn-small">{callLabel} · {phone.display}</CallLink>}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button type="submit" className="btn btn-primary grow" disabled={phase === "sending"}>
              {phase === "sending" ? "Sending…" : "Send my request"}
            </button>
          </div>
          <p className="consent">{consent}</p>
        </div>
      )}
    </form>
  );
}
