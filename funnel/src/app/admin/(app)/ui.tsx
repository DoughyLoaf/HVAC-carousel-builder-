import Link from "next/link";
import { INFLUENCE_LABEL, type Influence } from "@/lib/attribution";
import { STATUS_LABEL, type LeadStatus, type Outcome } from "@/lib/store";
import { RANGES, type RangeKey } from "@/lib/time";
import { formatDollars } from "@/lib/validate";

export function StatusPill({ status }: { status: LeadStatus }) {
  return <span className={`pill pill-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function InfluenceChip({ influence }: { influence: Influence }) {
  return <span className="chip-inf">{INFLUENCE_LABEL[influence] ?? influence}</span>;
}

export function ErrorBanner({ error }: { error?: string }) {
  return error ? <p className="banner banner-stop" role="alert">{error}</p> : null;
}

export function RangeTabs({ base, current, extra = "" }: { base: string; current: RangeKey; extra?: string }) {
  return (
    <div className="tabs" role="group" aria-label="Date range">
      {(Object.keys(RANGES) as RangeKey[]).map((k) => (
        <Link key={k} href={`${base}?range=${k}${extra}`} aria-current={k === current ? "true" : undefined}>{RANGES[k]}</Link>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}

const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");

/** Leads → contacted → booked → won, as bars on one shared scale with the numbers written out. */
export function Funnel({ o }: { o: Outcome }) {
  const rows: [string, number][] = [["Leads", o.leads], ["Contacted", o.contacted], ["Booked", o.booked], ["Won", o.won]];
  return (
    <div className="funnel" role="img" aria-label={rows.map(([l, n]) => `${l}: ${n}`).join(", ")}>
      {rows.map(([label, n]) => (
        <div className="funnel-row" key={label} title={`${label}: ${n} (${pct(n, o.leads)} of leads)`}>
          <span className="funnel-label">{label}</span>
          <span className="funnel-track"><span className="funnel-bar" style={{ width: o.leads > 0 ? `${(n / o.leads) * 100}%` : "0%" }} /></span>
          <span className="funnel-n">{n}</span>
          <span className="funnel-pct">{label === "Leads" ? "" : pct(n, o.leads)}</span>
        </div>
      ))}
    </div>
  );
}

export interface OutcomeRow extends Outcome {
  key: string;
  label: string;
  sub?: string;
  callTaps?: number;
  spendCents?: number | null;
}

export function OutcomeTable({ rows, first, showTaps, showSpend, empty }: {
  rows: OutcomeRow[]; first: string; showTaps?: boolean; showSpend?: boolean; empty: string;
}) {
  if (rows.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="table-scroll">
      <table className="atable">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="num">Leads</th>
            <th className="num">Contacted</th>
            <th className="num">Booked</th>
            <th className="num">Won</th>
            <th className="num">Reported revenue</th>
            {showTaps && <th className="num">Call taps</th>}
            {showSpend && <th className="num">Reported spend</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}{r.sub && <span className="sub">{r.sub}</span>}</th>
              <td className="num">{r.leads}</td>
              <td className="num">{r.contacted}</td>
              <td className="num">{r.booked}</td>
              <td className="num">{r.won}</td>
              <td className="num">{r.revenue_cents > 0 ? formatDollars(r.revenue_cents) : "—"}</td>
              {showTaps && <td className="num">{r.callTaps ?? 0}</td>}
              {showSpend && <td className="num">{formatDollars(r.spendCents)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Legend() {
  return (
    <p className="legend-note">
      <strong>How to read these numbers.</strong> Leads, contacted, booked and won are counted from this workspace’s
      own records. <strong>Reported revenue</strong> and <strong>reported spend</strong> are figures a person typed
      in, with their name beside them — not measured by this app. <strong>Call taps</strong> are taps on a “Call CDA”
      button, not confirmed phone calls.
    </p>
  );
}
