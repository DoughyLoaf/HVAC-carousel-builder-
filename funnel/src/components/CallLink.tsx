"use client";

import type { ReactNode } from "react";
import { captureTouch } from "@/lib/client/touch";

/** A tap-to-call link that also notes the tap (and what brought the visitor) for reporting. */
export function CallLink({ tel, placement, className, children }: { tel: string; placement: string; className?: string; children: ReactNode }) {
  function onClick() {
    try {
      const payload = JSON.stringify({ kind: "call_click", placement, touch: captureTouch().last });
      const blob = new Blob([payload], { type: "application/json" });
      if (!navigator.sendBeacon?.("/api/events", blob)) {
        void fetch("/api/events", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    } catch {
      // Tracking must never stop the call.
    }
  }
  return (
    <a href={`tel:${tel}`} className={className} onClick={onClick} data-placement={placement}>
      {children}
    </a>
  );
}
