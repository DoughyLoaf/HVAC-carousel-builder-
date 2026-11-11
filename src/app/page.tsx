import Link from "next/link";
import { listSummaries, type CarouselSummary } from "@/lib/service";

export const dynamic = "force-dynamic";

function StatusChips({ c }: { c: CarouselSummary }) {
  if (c.status === "blocked") return <span className="chip stop">Blocked</span>;
  if (c.status === "source_missing") return <span className="chip stop">Source file missing</span>;
  if (c.status === "source_error") return <span className="chip stop">Source file problem</span>;
  if (c.status === "missing_copy") return <span className="chip stop">Missing copy</span>;
  return (
    <>
      <span className="chip ok">Ready</span>
      {c.photos_missing > 0 ? (
        <span className="chip warn">
          Photos missing: {c.photos_missing} of {c.slide_count}
        </span>
      ) : (
        <span className="chip ok">All photos assigned</span>
      )}
    </>
  );
}

export default async function Home() {
  const { carousels, sources, photo_count } = await listSummaries();
  const missingFiles = sources.files.filter((f) => !f.present);
  const missingRequired = missingFiles.some((f) => f.required);
  const order = sources.registry.suggested_order;

  return (
    <>
      <div className="page-head">
        <h1>Carousels</h1>
        <p className="lede">
          Open a carousel, put the real stills into its slide slots, and export ordered JPGs with the
          caption, hashtags and GBP line. One template, the same way every time.
        </p>
      </div>

      {missingFiles.length > 0 && (
        <div className={`callout ${missingRequired ? "stop" : "info"}`} style={{ marginBottom: 14 }}>
          <h2>
            {missingRequired
              ? "Source copy files are not in place yet"
              : "Reference files not in the content folder"}
          </h2>
          <p>
            {missingRequired ? (
              <>
                The copy is read from the build-ready Markdown files. Copy the missing files into the{" "}
                <code>content/</code> folder of this app, then reload. Nothing is written or filled in
                until they are there.
              </>
            ) : (
              <>
                All build-ready copy files are in place. The reference files below are optional for
                building — copy them into <code>content/</code> to keep the set together.
              </>
            )}
          </p>
          <ul className="files" style={{ marginTop: 10, paddingLeft: 0 }}>
            {sources.files.map((f) => (
              <li key={f.file}>
                <span className={`chip ${f.present ? "ok" : f.required ? "stop" : "warn"}`}>
                  {f.present ? "Found" : "Missing"}
                </span>
                <code>{f.file}</code>
                <span className="muted">{f.role}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources.errors.length > 0 && (
        <div className="callout stop" style={{ marginBottom: 14 }}>
          <h2>Problems reading source files</h2>
          <ul>{sources.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}

      <section className="panel">
        <div className="clist">
          {carousels.map((c) => {
            return (
              <div className="crow" key={c.id}>
                <div className="cnum">{c.id}</div>
                <div>
                  <Link className="ctitle" href={`/carousel/${c.id}`}>{c.title}</Link>
                  <div className="cmeta">
                    {c.slide_count ? `${c.slide_count} slides` : "Slides not loaded"}
                    {c.pairs_with ? ` · pairs with ${c.pairs_with}` : ""}
                    {c.origin === "created" ? " · created in this app" : ""}
                    {c.source_file ? <> · <code>{c.source_file}</code></> : null}
                  </div>
                  {c.status !== "ready" && c.status_reason && (
                    <p className="creason">{c.status_reason}</p>
                  )}
                </div>
                <div className="cstatus"><StatusChips c={c} /></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Posting order — suggested, not enforced</h2>
        <div className="stack small">
          <p>
            {order.length
              ? order
                  .map((g, i) => `${i === 0 ? "Carousels " : "then "}${g.join(" and ")}${i === 0 ? " first" : ""}`)
                  .join(", ") + "."
              : "No suggested order set."}{" "}
            Post one at a time — do not post all eight at once. This tool builds and exports; it does
            not queue, schedule or publish anything.
          </p>
          <p>
            One carousel a week also becomes the weekly GBP post. The GBP line is on each carousel&apos;s
            page to copy — it is never auto-posted.
          </p>
        </div>
      </section>

      <section className="panel">
        <h2>Selects library</h2>
        <p className="small">
          {photo_count === 0
            ? "No photos uploaded yet. Open a carousel and drop the real stills into its slots — every slide exports as its text-slide fallback until a photo is assigned."
            : `${photo_count} photo${photo_count === 1 ? "" : "s"} in the local library. Assign them from any carousel page.`}
        </p>
      </section>
    </>
  );
}
