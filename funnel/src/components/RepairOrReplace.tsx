"use client";

import { useId, useState } from "react";
import { IntentLink } from "./IntentLink";

interface Side {
  tab: string;
  signals: { title: string; body: string }[];
}

/** Two tabs — repair signals and replacement signals — each ending in the matching request button. */
export function RepairOrReplace({ repair, replace, serviceLabel, estimateLabel }: {
  repair: Side; replace: Side; serviceLabel: string; estimateLabel: string;
}) {
  const [side, setSide] = useState<"repair" | "replace">("repair");
  const uid = useId();
  const tabs = [
    { id: "repair" as const, data: repair, intent: "heating_service", cta: serviceLabel },
    { id: "replace" as const, data: replace, intent: "replacement_estimate", cta: estimateLabel },
  ];
  const current = tabs.find((t) => t.id === side)!;

  function onKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = side === "repair" ? "replace" : "repair";
    setSide(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  }

  return (
    <div className="ror">
      <div className="ror-tabs" role="tablist" aria-label="Repair or replace" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`${uid}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={side === t.id}
            aria-controls={`${uid}-panel`}
            tabIndex={side === t.id ? 0 : -1}
            className={side === t.id ? "ror-tab on" : "ror-tab"}
            onClick={() => setSide(t.id)}
          >
            {t.data.tab}
          </button>
        ))}
      </div>
      <div className="ror-panel" role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-tab-${side}`} key={side}>
        <ul className="ror-signals">
          {current.data.signals.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ul>
        <IntentLink intent={current.intent} className="btn btn-primary">{current.cta}</IntentLink>
      </div>
    </div>
  );
}
