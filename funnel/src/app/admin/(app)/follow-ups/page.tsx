import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { listOpenFollowups, type FollowupRow } from "@/lib/store";
import { formatDay, todayInBusinessTz } from "@/lib/time";
import { REQUEST_LABEL } from "@/lib/validate";
import { finishFollowup } from "../actions";
import { StatusPill } from "../ui";

function Group({ title, rows, tone }: { title: string; rows: FollowupRow[]; tone?: string }) {
  if (rows.length === 0) return null;
  return (
    <section className="panel">
      <h2 className={tone}>{title} · {rows.length}</h2>
      <ul className="rows">
        {rows.map((f) => (
          <li key={f.id} className="row-item">
            <div className="row-main">
              <Link href={`/admin/leads/${f.lead_id}`} className="row-title">{f.lead_name}</Link>
              <p className="card-meta"><span>{formatDay(f.due_on)}</span><span>{REQUEST_LABEL[f.request_type]}</span><StatusPill status={f.lead_status} /></p>
              {f.note && <p>{f.note}</p>}
            </div>
            <div className="row-actions">
              {f.lead_phone && <a className="abtn" href={`tel:${f.lead_phone.replace(/\D/g, "")}`}>Call</a>}
              <form action={finishFollowup}>
                <input type="hidden" name="followup_id" value={f.id} />
                <input type="hidden" name="return_to" value="list" />
                <button className="abtn abtn-primary">Done</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function FollowUps() {
  await requireAdmin();
  const today = todayInBusinessTz();
  const all = await listOpenFollowups(await getDb());
  return (
    <>
      <div className="page-head"><h1>Follow-ups</h1></div>
      {all.length === 0 && <p className="empty">Nothing to follow up. Set a follow-up from any lead.</p>}
      <Group title="Overdue" tone="tone-stop" rows={all.filter((f) => f.due_on < today)} />
      <Group title="Today" rows={all.filter((f) => f.due_on === today)} />
      <Group title="Coming up" rows={all.filter((f) => f.due_on > today)} />
    </>
  );
}
