import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { listJobs } from "@/lib/store";
import { formatDay } from "@/lib/time";
import { formatDollars } from "@/lib/validate";
import { InfluenceChip, Legend, Stat } from "../ui";

export default async function Jobs() {
  await requireAdmin();
  const jobs = await listJobs(await getDb());
  const live = jobs.filter((j) => j.status !== "cancelled");
  const revenue = live.reduce((sum, j) => sum + (j.reported_revenue_cents ?? 0), 0);
  const awaiting = live.filter((j) => j.status === "completed" && j.reported_revenue_cents === null).length;

  return (
    <>
      <div className="page-head"><h1>Jobs</h1></div>
      <section className="panel">
        <div className="stats">
          <Stat label="Booked" value={String(jobs.filter((j) => j.status === "booked").length)} />
          <Stat label="Completed" value={String(jobs.filter((j) => j.status === "completed").length)} />
          <Stat label="Reported revenue" value={formatDollars(revenue)} sub="typed in by a person" />
          <Stat label="Completed, no revenue reported" value={String(awaiting)} />
        </div>
      </section>
      {jobs.length === 0 ? (
        <p className="empty">No jobs yet. Add one from a lead once it is booked.</p>
      ) : (
        <div className="table-scroll panel">
          <table className="atable">
            <thead>
              <tr><th>Customer</th><th>Job</th><th>Status</th><th>Scheduled</th><th>Completed</th><th className="num">Reported revenue</th><th>Reported by</th><th>Came from</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className={j.status === "cancelled" ? "dim" : ""}>
                  <th scope="row"><Link href={`/admin/leads/${j.lead_id}`}>{j.lead_name}</Link>{j.lead_town && <span className="sub">{j.lead_town}</span>}</th>
                  <td>{j.job_type}{j.description && <span className="sub">{j.description}</span>}</td>
                  <td>{j.status}</td>
                  <td>{formatDay(j.scheduled_on)}</td>
                  <td>{formatDay(j.completed_on)}</td>
                  <td className="num">{formatDollars(j.reported_revenue_cents)}</td>
                  <td>{j.revenue_reported_by || "—"}{j.revenue_reported_on && <span className="sub">{formatDay(j.revenue_reported_on)}</span>}</td>
                  <td><InfluenceChip influence={j.influence} />{j.utm_campaign && <span className="sub mono">{j.utm_campaign}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Legend />
    </>
  );
}
