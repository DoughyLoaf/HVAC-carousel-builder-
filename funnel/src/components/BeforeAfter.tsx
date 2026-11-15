"use client";

import Image from "next/image";
import { useState } from "react";

/** Drag-to-compare. A real range input does the work, so it is keyboard and screen-reader usable. */
export function BeforeAfter({ before, after, hint }: { before: { src: string; alt: string }; after: { src: string; alt: string }; hint: string }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="ba" style={{ "--pos": `${pos}%` } as React.CSSProperties}>
      <Image src={after.src} alt={after.alt} fill sizes="(max-width: 900px) 100vw, 900px" className="ba-img" />
      <div className="ba-before" aria-hidden={pos < 5}>
        <Image src={before.src} alt={before.alt} fill sizes="(max-width: 900px) 100vw, 900px" className="ba-img" />
      </div>
      <span className="ba-tag ba-tag-before">Before</span>
      <span className="ba-tag ba-tag-after">After</span>
      <div className="ba-handle" aria-hidden="true"><span>⇆</span></div>
      <input
        className="ba-range"
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`${hint}: how much of the before photo is shown`}
      />
    </div>
  );
}
