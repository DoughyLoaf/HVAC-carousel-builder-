import { NextResponse } from "next/server";
import { copy } from "@content/site";
import { getDb } from "@/lib/db";
import { notifyConfigFromEnv, notifyNewLead } from "@/lib/notify";
import { readJson, sameOrigin } from "@/lib/request";
import { clientIp, hashIp } from "@/lib/session";
import { countRecentLeadsFromIp, createLead, recordNotification, setLeadStatus } from "@/lib/store";
import { parseLead } from "@/lib/validate";

const MAX_PER_HOUR = 5;
const CALL_INSTEAD = "We couldn’t save your request. Please call us instead.";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Bad origin." }, { status: 403 });

  const body = await readJson(request);
  if (body === null) return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });

  const parsed = parseLead(body);
  if (!parsed.ok) return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });

  // The consent wording stored with the lead is the wording this server shows, not whatever the browser sends.
  parsed.lead.consent_text = copy.form.consent;

  const ipHash = hashIp(clientIp(request.headers));
  // A hidden field no person can see. Anything that fills it is kept, but
  // filed as spam and never alerted on — nothing is silently thrown away.
  const honeypot = typeof (body as { company?: unknown }).company === "string" && (body as { company: string }).company.trim() !== "";

  try {
    const db = await getDb();
    if ((await countRecentLeadsFromIp(db, ipHash, 60)) >= MAX_PER_HOUR) {
      return NextResponse.json(
        { ok: false, error: "We already have several requests from this connection. Please call us so we can help right away." },
        { status: 429 },
      );
    }

    const lead = await createLead(db, parsed.lead, {
      origin: "web_form",
      ipHash,
      userAgent: request.headers.get("user-agent") ?? "",
    });

    if (honeypot) {
      await setLeadStatus(db, lead.id, "spam", "Filed automatically: the hidden anti-spam field was filled in.");
    } else {
      const results = await notifyNewLead(lead, notifyConfigFromEnv());
      for (const r of results) {
        await recordNotification(db, lead.id, r).catch((err) => console.error("[leads] could not record notification:", err));
        if (r.status !== "sent") console.error(`[leads] alert ${r.channel} ${r.status} for lead ${lead.id}: ${r.detail}`);
      }
    }

    return NextResponse.json({ ok: true, ref: lead.id.slice(0, 8).toUpperCase() }, { status: 201 });
  } catch (err) {
    console.error("[leads] could not save a lead:", err);
    return NextResponse.json({ ok: false, error: CALL_INSTEAD }, { status: 503 });
  }
}
