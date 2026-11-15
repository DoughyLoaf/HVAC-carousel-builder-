import Image from "next/image";
import type { PhotoSlot } from "@content/site";

/**
 * Shows a slot's photo when it is usable. Otherwise: a labelled placeholder in
 * preview (so whoever reviews the page sees what is missing), nothing in live.
 * No stock or generated image is ever substituted.
 */
export function PhotoFrame({ slot, usable, preview, sizes, priority, className }: {
  slot: PhotoSlot; usable: boolean; preview: boolean; sizes: string; priority?: boolean; className?: string;
}) {
  if (usable) {
    return (
      <div className={`photo ${className ?? ""}`}>
        <Image src={`/photos/${slot.file}`} alt={slot.alt} fill sizes={sizes} priority={priority} />
      </div>
    );
  }
  if (!preview) return null;
  const why = !slot.file ? "no file assigned" : !slot.alt.trim() ? "alt text missing" : slot.insideHome && slot.permission !== "Y" ? "homeowner permission not recorded" : "file not found in public/photos/";
  return (
    <div className={`photo photo-empty ${className ?? ""}`}>
      <p><strong>Photo slot “{slot.id}”</strong> — {why}</p>
      <p>{slot.wanted}</p>
    </div>
  );
}
