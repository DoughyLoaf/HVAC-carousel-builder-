export function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "untitled";
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function exportFolderName(id: number, title: string): string {
  return `carousel-${pad2(id)}-${slugify(title)}`;
}
