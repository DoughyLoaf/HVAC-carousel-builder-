import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { INFLUENCE_LABEL, type Influence } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import { describeChannels, notifyConfigFromEnv } from "@/lib/notify";
import { attention, callClicksBy, outcomeBy, outcomeTotals } from "@/lib/store";
import { parseRange, RANGES, todayInBusinessTz } from "@/lib/time";
import { formatDollars, REQUEST_LABEL, type RequestType } from "@/lib/validate";
import { Funnel, Legend, OutcomeTable, RangeTabs, Stat } from "./ui";

export default async function Overview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const { key, since } = parseRange((await searchParams).range);
  const db = await getDb();
  const [totals, byInfluence, byType, taps, todo] = await Promise.all([
    outcomeTotals(db, since),
    outcomeBy(db, "influence", since),
    outcomeBy(db, "request_type", since),
    callClicksBy(db, "influence", since),
    attention(db, todayInBusinessTz()),
  ]);
  const totalTaps = Object.values(taps).reduce((a, b) => a + b, 0);
  const channels = describeChannels(notifyConfigFromEnv());
  const alertsOff = !channels.email && !channels.webhook;

  // Sources that produced call taps but no leads still deserve a row.
  const influenceKeys = [...new Set([...byInfluence.map((r) => r.key), ...Object.keys(taps)])];
  const influenceRows = influenceKeys.map((k) => {
    const row = byInfluence.find((r) => r.key === k) ?? { key: k, leads: 0, contacted: 0, booked: 0, won: 0, revenue_cents: 0 };
    return { ...row, label: INFLUENCE_LABEL[k as Influence] ?? k, callTaps: taps[k] ?? 0 };
  });

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <RangeTabs base="/admin" current={key} />
      </div>

      {alertsOff && (
        <p className="banner banner-stop">
          <strong>Nobody is being alerted about new leads.</strong> No email or webhook is set up, so requests are
          saved here and nowhere else. <Link href="/admin/launch">See setup</Link>
        </p>
      )}

      <section className="todo" aria-label="Needs attention">
        <Link href="/admin/leads?status=new" className={todo.new_leads > 0 ? "todo-item hot" : "todo-item"}>
          <strong>{todo.new_leads}</strong> new lead{todo.new_leads === 1 ? "" : "s"} waiting for a first call
        </Link>
        <Link href="/admin/follow-ups" className={todo.overdue_followups > 0 ? "todo-item hot" : "todo-item"}>
          <strong>{todo.overdue_followups}</strong> follow-up{todo.overdue_followups === 1 ? "" : "s"} overdue
        </Link>
        <Link href="/admin/follow-ups" className="todo-item">
          <strong>{todo.due_today}</strong> follow-up{todo.due_today === 1 ? "" : "s"} due today
        </Link>
        {todo.unnotified > 0 && (
          <Link href="/admin/leads?status=new" className="todo-item hot">
            <strong>{todo.unnotified}</strong> new web lead{todo.unnotified === 1 ? "" : "s"} with no alert delivered
          </Link>
        )}
      </section>

      <section className="panel">
        <h2>Outcomes · {RANGES[key].toLowerCase()}</h2>
        <p className="muted">Leads created in this period, and what has happened to them since.</p>
        <div className="stats">
          <Stat label="Leads" value={String(totals.leads)} />
          <Stat label="Booked" value={String(totals.booked)} sub={totals.leads > 0 ? `${Math.round((totals.booked / totals.leads) * 100)}% of leads` : undefined} />
          <Stat label="Won" value={String(totals.won)} />
          <Stat label="Reported revenue" value={formatDollars(totals.revenue_cents)} sub="typed in by a person" />
          <Stat label="Call taps" value={String(totalTaps)} sub="taps, not confirmed calls" />
        </div>
        <Funnel o={totals} />
      </section>

      <section className="panel">
        <h2>What brought them in</h2>
        <OutcomeTable rows={influenceRows} first="Influence" showTaps empty="No leads or call taps in this period yet." />
        <p className="more"><Link href={`/admin/attribution?range=${key}`}>Campaigns, content and landing pages →</Link></p>
      </section>

      <section className="panel">
        <h2>What they asked for</h2>
        <OutcomeTable
          rows={byType.map((r) => ({ ...r, label: REQUEST_LABEL[r.key as RequestType] ?? r.key }))}
          first="Request" empty="No leads in this period yet."
        />
      </section>

      <Legend />
    </>
  );
}
