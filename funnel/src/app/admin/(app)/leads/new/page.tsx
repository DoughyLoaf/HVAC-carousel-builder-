import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { INFLUENCE_LABEL, INFLUENCES } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import { listCampaigns } from "@/lib/store";
import { REQUEST_LABEL, REQUEST_TYPES, URGENCY_LABEL } from "@/lib/validate";
import { createManualLead } from "../../actions";
import { ErrorBanner } from "../../ui";

export default async function NewLead({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const campaigns = await listCampaigns(await getDb());
  return (
    <>
      <p className="crumb"><Link href="/admin/leads">← Leads</Link></p>
      <h1>Add a lead</h1>
      <p className="muted">For a phone call, a walk-in or a referral that never touched the website form.</p>
      <ErrorBanner error={(await searchParams).error} />
      <form action={createManualLead} className="panel form-grid">
        <label className="afield"><span>Name</span><input name="name" required /></label>
        <label className="afield"><span>Phone</span><input name="phone" type="tel" inputMode="tel" /></label>
        <label className="afield"><span>Email</span><input name="email" type="email" /></label>
        <label className="afield"><span>What they need</span>
          <select name="request_type" required defaultValue="heating_service">
            {REQUEST_TYPES.map((t) => <option key={t} value={t}>{REQUEST_LABEL[t]}</option>)}
          </select>
        </label>
        <label className="afield"><span>How soon</span>
          <select name="urgency" defaultValue="">
            {(["", "urgent", "soon", "planning"] as const).map((u) => <option key={u} value={u}>{URGENCY_LABEL[u]}</option>)}
          </select>
        </label>
        <label className="afield"><span>Town</span><input name="town" /></label>
        <label className="afield wide"><span>Notes from the call</span><textarea name="message" rows={3} /></label>

        <label className="afield"><span>What brought them in</span>
          <select name="influence" required defaultValue="">
            <option value="" disabled>Choose one</option>
            {INFLUENCES.map((i) => <option key={i} value={i}>{INFLUENCE_LABEL[i]}</option>)}
          </select>
        </label>
        <label className="afield"><span>Campaign, if they named one</span>
          <select name="campaign" defaultValue="">
            <option value="">None</option>
            {campaigns.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label className="afield"><span>In their words: how they heard about CDA</span><input name="self_reported_source" /></label>
        <label className="afield"><span>Your name</span><input name="who" required /></label>
        <div className="wide"><button className="abtn abtn-primary">Save lead</button></div>
      </form>
    </>
  );
}
