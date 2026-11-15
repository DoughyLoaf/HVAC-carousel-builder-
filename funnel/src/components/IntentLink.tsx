"use client";

import type { ReactNode } from "react";

export const INTENT_EVENT = "cda:intent";

/** Jumps to the request form with a request type already chosen. Works as a plain anchor without JavaScript. */
export function IntentLink({ intent, className, children }: { intent: string; className?: string; children: ReactNode }) {
  return (
    <a
      href="#request"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(INTENT_EVENT, { detail: intent }))}
    >
      {children}
    </a>
  );
}
