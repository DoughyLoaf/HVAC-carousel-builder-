import fs from "node:fs";
import { REGISTRY_FILE } from "./paths";
import type { Registry } from "./types";

export function loadRegistry(): Registry {
  let raw: string;
  try {
    raw = fs.readFileSync(REGISTRY_FILE, "utf8");
  } catch {
    throw new Error(
      `carousel-registry.json not found at ${REGISTRY_FILE}. It lists the eight Shoot 1 carousels and which are blocked.`,
    );
  }
  const json = JSON.parse(raw);
  if (!Array.isArray(json.carousels)) {
    throw new Error("carousel-registry.json: \"carousels\" must be a list.");
  }
  return {
    carousels: json.carousels,
    suggested_order: json.suggested_order ?? [],
    outline_file: json.outline_file ?? "",
    selects_map_files: json.selects_map_files ?? [],
    selects_checklist_file: json.selects_checklist_file ?? "",
  };
}
