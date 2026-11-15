import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import {
  addFollowup, addJob, addNote, attention, attributionRows, callClicksBy, completeFollowup, countRecentLeadsFromIp,
  createCampaign, createLead, getCampaignBySlug, getLead, listJobs, listLeads, listOpenFollowups, outcomeBy,
  outcomeTotals, recentFailedLogins, recordLoginAttempt, recordNotification, recordTouchEvent, setInfluence,
  setLeadStatus, updateJob, type JobInput,
} from "@/lib/store";
import { freshDb, leadInput, touch } from "./helpers";

const job = (over: Partial<JobInput> = {}): JobInput => ({
  job_type: "replacement", description: "", status: "booked", scheduled_on: null, completed_on: null,
  reported_revenue_cents: null, revenue_reported_by: "", revenue_reported_on: null, ...over,
});

describe("leads", () => {
  let db: Db;
  beforeAll(async () => { db = await freshDb(); });
  afterAll(async () => { await db.close(); });

  it("saves a web lead with its attribution and the rule that produced it", async () => {
    const lead = await createLead(
      db,
      leadInput({
        name: "Kim Ortiz",
        last_touch: touch({ utm_source: "instagram", utm_medium: "carousel", utm_campaign: "Carousel-4", utm_content: "slide-7" }),
        first_touch: touch({ referrer: "https://www.google.com/" }),
        self_reported_source: "Instagram",
      }),
      { origin: "web_form", ipHash: "abc", userAgent: "test" },
    );
    expect(lead.status).toBe("new");
    expect(lead.influence).toBe("content");
    expect(lead.influence_basis).toContain("utm_source=instagram");
    expect(lead.created_at).toBeInstanceOf(Date);

    const detail = await getLead(db, lead.id);
    expect(detail?.lead.first_touch?.referrer).toBe("https://www.google.com/");
    expect(detail?.events.map((e) => e.kind)).toEqual(["created"]);
    expect(detail?.campaign).toBeNull();
    expect(await countRecentLeadsFromIp(db, "abc", 60)).toBe(1);
    expect(await countRecentLeadsFromIp(db, "other", 60)).toBe(0);
  });

  it("when the converting visit is direct, the first visit's campaign and landing page get the credit", async () => {
    const lead = await createLead(
      db,
      leadInput({
        name: "Came Back Later",
        last_touch: touch({ landing_path: "/" }),
        first_touch: touch({ landing_path: "/", gclid: "g1", utm_source: "google", utm_medium: "cpc", utm_campaign: "furnace-search", utm_content: "ad-2" }),
      }),
      { origin: "web_form" },
    );
    expect(lead).toMatchObject({ influence: "ad", utm_campaign: "furnace-search", utm_content: "ad-2", gclid: "g1" });
    expect(lead.influence_basis).toMatch(/^First visit/);
    // Both visits are kept as captured.
    expect(lead.last_touch?.utm_campaign).toBe("");
    expect(lead.first_touch?.utm_campaign).toBe("furnace-search");
  });

  it("a lead typed in by staff has no captured visits", async () => {
    const lead = await createLead(db, leadInput({ name: "Phoned In" }), {
      origin: "manual", influence: { influence: "referral", basis: "Entered by hand by Austin" },
    });
    expect(lead).toMatchObject({ influence: "referral", influence_basis: "Entered by hand by Austin", last_touch: null });
  });

  it("getLead returns null for a missing or malformed id instead of throwing", async () => {
    expect(await getLead(db, "not-a-uuid")).toBeNull();
    expect(await getLead(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("the database refuses values outside the allowed lists", async () => {
    await expect(
      createLead(db, leadInput({ request_type: "free_money" as never }), { origin: "web_form" }),
    ).rejects.toThrow();
  });

  it("status changes keep the milestone dates consistent", async () => {
    const lead = await createLead(db, leadInput({ name: "Status Person" }), { origin: "web_form" });
    const get = async () => (await getLead(db, lead.id))!.lead;

    await setLeadStatus(db, lead.id, "contacted");
    expect((await get()).contacted_at).toBeInstanceOf(Date);
    expect((await get()).booked_at).toBeNull();

    await setLeadStatus(db, lead.id, "booked");
    const bookedAt = (await get()).booked_at;
    expect(bookedAt).toBeInstanceOf(Date);

    // A cancelled booking still counts as having been booked.
    await setLeadStatus(db, lead.id, "lost", "Went with another company.");
    expect((await get()).booked_at).toEqual(bookedAt);
    expect((await get()).closed_at).toBeInstanceOf(Date);

    // Undoing a mis-click back to "contacted" clears booked and closed.
    await setLeadStatus(db, lead.id, "contacted");
    expect((await get()).booked_at).toBeNull();
    expect((await get()).closed_at).toBeNull();

    const events = (await getLead(db, lead.id))!.events.filter((e) => e.kind === "status").map((e) => e.body);
    expect(events).toContain("Booked → Lost. Went with another company.");
    expect(await setLeadStatus(db, lead.id, "bogus" as never)).toBe(false);
  });

  it("adding a job books the lead; completing it wins the lead", async () => {
    const lead = await createLead(db, leadInput({ name: "Job Person" }), { origin: "manual" });
    await addJob(db, lead.id, job({ scheduled_on: "2026-11-20" }));
    let detail = (await getLead(db, lead.id))!;
    expect(detail.lead.status).toBe("booked");
    expect(detail.jobs[0].scheduled_on).toBe("2026-11-20");

    await updateJob(db, detail.jobs[0].id, job({
      status: "completed", completed_on: "2026-11-21", reported_revenue_cents: 845000,
      revenue_reported_by: "Erika", revenue_reported_on: "2026-11-22",
    }));
    detail = (await getLead(db, lead.id))!;
    expect(detail.lead.status).toBe("won");
    expect(detail.jobs[0].reported_revenue_cents).toBe(845000);
    expect(detail.jobs[0].revenue_reported_by).toBe("Erika");
  });

  it("revenue cannot be saved without saying who reported it", async () => {
    const lead = await createLead(db, leadInput({ name: "No Reporter" }), { origin: "manual" });
    await expect(addJob(db, lead.id, job({ reported_revenue_cents: 1000 }))).rejects.toThrow(/revenue_needs_reporter/);
  });

  it("follow-ups, notes and manual attribution land on the timeline", async () => {
    const lead = await createLead(db, leadInput({ name: "Follow Person" }), { origin: "web_form" });
    await addFollowup(db, lead.id, "2026-11-10", "Call back about the quote");
    await addFollowup(db, lead.id, "2026-11-15", "");
    await addNote(db, lead.id, "Left a voicemail.");
    await setInfluence(db, lead.id, "referral", "", "Austin");

    const open = (await listOpenFollowups(db)).filter((f) => f.lead_id === lead.id);
    expect(open.map((f) => f.due_on)).toEqual(["2026-11-10", "2026-11-15"]);
    expect(open[0].lead_name).toBe("Follow Person");

    const a = await attention(db, "2026-11-15");
    expect(a.overdue_followups).toBeGreaterThanOrEqual(1);
    expect(a.due_today).toBeGreaterThanOrEqual(1);

    await completeFollowup(db, open[0].id);
    await completeFollowup(db, open[0].id); // twice is harmless
    const detail = (await getLead(db, lead.id))!;
    expect(detail.followups.filter((f) => f.done_at).length).toBe(1);
    expect(detail.lead.influence).toBe("referral");
    expect(detail.lead.influence_basis).toBe("Set by hand by Austin");
    expect(detail.events.map((e) => e.kind)).toEqual(expect.arrayContaining(["note", "followup", "attribution"]));
  });

  it("lists leads by status, never showing spam in the default list", async () => {
    const spam = await createLead(db, leadInput({ name: "Spam Bot" }), { origin: "web_form" });
    await setLeadStatus(db, spam.id, "spam");
    const all = await listLeads(db);
    expect(all.some((l) => l.name === "Spam Bot")).toBe(false);
    expect((await listLeads(db, { status: "spam" })).map((l) => l.name)).toEqual(["Spam Bot"]);
    const open = await listLeads(db, { status: "open" });
    expect(open.every((l) => l.status === "new" || l.status === "contacted")).toBe(true);
    const won = (await listLeads(db, { status: "won" }))[0];
    expect(won.job_count).toBe(1);
    expect(won.revenue_cents).toBe(845000);
  });

  it("notification attempts are recorded, and a new web lead nobody was alerted about is flagged", async () => {
    const lead = await createLead(db, leadInput({ name: "Unnotified" }), { origin: "web_form" });
    const before = (await attention(db, "2026-11-15")).unnotified;
    await recordNotification(db, lead.id, { channel: "email", status: "failed", detail: "HTTP 401" });
    expect((await attention(db, "2026-11-15")).unnotified).toBe(before);
    await recordNotification(db, lead.id, { channel: "webhook", status: "sent", detail: "ok" });
    expect((await attention(db, "2026-11-15")).unnotified).toBe(before - 1);
    expect((await getLead(db, lead.id))!.notifications.map((n) => n.status)).toEqual(["failed", "sent"]);
  });
});

describe("reporting", () => {
  let db: Db;
  beforeAll(async () => {
    db = await freshDb();
    await createCampaign(db, {
      slug: "carousel-4", name: "Carousel 4 — No heat?", influence: "content", utm_source: "instagram",
      utm_medium: "carousel", utm_content: "", content_ref: "Carousel 4", ad_ref: "", intent: "heating_service",
      starts_on: "2026-11-10", ends_on: null, reported_spend_cents: null, spend_reported_by: "", notes: "",
    });
    const ig = touch({ utm_source: "instagram", utm_medium: "carousel", utm_campaign: "carousel-4" });
    const ad = touch({ utm_source: "google", utm_medium: "cpc", utm_campaign: "furnace-search", gclid: "g1", landing_path: "/" });

    const a = await createLead(db, leadInput({ name: "A Content Won", last_touch: ig }), { origin: "web_form" });
    await addJob(db, a.id, job({ status: "completed", reported_revenue_cents: 900000, revenue_reported_by: "Erika" }));
    // A cancelled job's revenue must not count.
    await addJob(db, a.id, job({ status: "cancelled", reported_revenue_cents: 50000, revenue_reported_by: "Erika" }));

    const b = await createLead(db, leadInput({ name: "B Content Open", last_touch: ig }), { origin: "web_form" });
    await setLeadStatus(db, b.id, "contacted");

    const c = await createLead(db, leadInput({ name: "C Ad Booked", last_touch: ad }), { origin: "web_form" });
    await setLeadStatus(db, c.id, "booked");

    await createLead(db, leadInput({ name: "D Direct New" }), { origin: "web_form" });
    const spam = await createLead(db, leadInput({ name: "E Spam", last_touch: ad }), { origin: "web_form" });
    await setLeadStatus(db, spam.id, "spam");

    await recordTouchEvent(db, "call_click", "hero", ig, "ip1");
    await recordTouchEvent(db, "call_click", "sticky", ig, "ip1");
    await recordTouchEvent(db, "call_click", "hero", touch(), "ip2");
    await recordTouchEvent(db, "go_redirect", "", ig, "ip1");
  });
  afterAll(async () => { await db.close(); });

  it("totals exclude spam and cancelled-job revenue", async () => {
    expect(await outcomeTotals(db, null)).toEqual({ leads: 4, contacted: 3, booked: 2, won: 1, revenue_cents: 900000 });
  });

  it("a date range only counts leads created inside it", async () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(await outcomeTotals(db, future)).toEqual({ leads: 0, contacted: 0, booked: 0, won: 0, revenue_cents: 0 });
    expect((await outcomeTotals(db, new Date(Date.now() - 86_400_000))).leads).toBe(4);
  });

  it("groups outcomes by influence and by campaign", async () => {
    const byInfluence = Object.fromEntries((await outcomeBy(db, "influence", null)).map((r) => [r.key, r]));
    expect(byInfluence.content).toMatchObject({ leads: 2, contacted: 2, booked: 1, won: 1, revenue_cents: 900000 });
    expect(byInfluence.ad).toMatchObject({ leads: 1, booked: 1, won: 0, revenue_cents: 0 });
    expect(byInfluence.direct).toMatchObject({ leads: 1, booked: 0 });

    const byCampaign = Object.fromEntries((await outcomeBy(db, "campaign", null)).map((r) => [r.key, r]));
    expect(byCampaign["carousel-4"].leads).toBe(2);
    expect(byCampaign["furnace-search"].leads).toBe(1);
    expect(byCampaign[""].leads).toBe(1);
  });

  it("counts call taps separately from leads", async () => {
    expect(await callClicksBy(db, "influence", null)).toEqual({ content: 2, direct: 1 });
    expect(await callClicksBy(db, "campaign", null)).toEqual({ "carousel-4": 2, "": 1 });
  });

  it("the attribution list names the campaign and content piece behind each lead and booked job", async () => {
    const rows = await attributionRows(db, null, false);
    expect(rows.map((r) => r.name).sort()).toEqual(["A Content Won", "B Content Open", "C Ad Booked", "D Direct New"]);
    const a = rows.find((r) => r.name === "A Content Won")!;
    expect(a).toMatchObject({ campaign_name: "Carousel 4 — No heat?", content_ref: "Carousel 4", job_count: 1, revenue_cents: 900000 });
    const c = rows.find((r) => r.name === "C Ad Booked")!;
    expect(c.campaign_name).toBeNull(); // tagged, but no campaign registered under that name

    const booked = await attributionRows(db, null, true);
    expect(booked.map((r) => r.name).sort()).toEqual(["A Content Won", "C Ad Booked"]);
  });

  it("campaign slugs are unique and matched case-insensitively", async () => {
    expect((await getCampaignBySlug(db, "CAROUSEL-4"))?.name).toBe("Carousel 4 — No heat?");
    const again = await createCampaign(db, {
      slug: "carousel-4", name: "dup", influence: "content", utm_source: "", utm_medium: "", utm_content: "",
      content_ref: "", ad_ref: "", intent: "", starts_on: null, ends_on: null, reported_spend_cents: null,
      spend_reported_by: "", notes: "",
    });
    expect(again).toBe(false);
  });

  it("lists jobs with the lead behind each", async () => {
    const jobs = await listJobs(db);
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.lead_name === "A Content Won" && j.influence === "content")).toBe(true);
  });

  it("failed sign-ins are counted per address", async () => {
    await recordLoginAttempt(db, "ipx", false);
    await recordLoginAttempt(db, "ipx", false);
    await recordLoginAttempt(db, "ipx", true);
    await recordLoginAttempt(db, "ipy", false);
    expect(await recentFailedLogins(db, "ipx", 15)).toBe(2);
  });
});
