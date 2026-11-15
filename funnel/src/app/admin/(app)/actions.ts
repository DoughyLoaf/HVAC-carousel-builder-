"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { EMPTY_TOUCH, INFLUENCES, type Influence } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import {
  addFollowup, addJob, addNote, completeFollowup, createCampaign, createLead, isUuid, JOB_STATUSES, JOB_TYPES,
  setInfluence, setLeadStatus, STATUSES, updateCampaign, updateJob, type JobInput, type JobStatus, type JobType,
  type LeadStatus,
} from "@/lib/store";
import { todayInBusinessTz } from "@/lib/time";
import { isDate, parseDollars, parseLead, slugify } from "@/lib/validate";

const str = (fd: FormData, key: string, max = 500): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

function back(path: string, error?: string): never {
  revalidatePath("/admin", "layout");
  redirect(error ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}` : path);
}

function leadPath(fd: FormData): string {
  const id = str(fd, "lead_id");
  return isUuid(id) ? `/admin/leads/${id}` : "/admin/leads";
}

export async function changeStatus(fd: FormData): Promise<void> {
  await requireAdmin();
  const path = leadPath(fd);
  const status = str(fd, "status") as LeadStatus;
  if (!STATUSES.includes(status)) back(path, "Choose a status.");
  await setLeadStatus(await getDb(), str(fd, "lead_id"), status, str(fd, "note", 1000));
  back(path);
}

export async function saveNote(fd: FormData): Promise<void> {
  await requireAdmin();
  const path = leadPath(fd);
  const body = str(fd, "body", 4000);
  if (!body) back(path, "Write a note first.");
  await addNote(await getDb(), str(fd, "lead_id"), body);
  back(path);
}

export async function saveFollowup(fd: FormData): Promise<void> {
  await requireAdmin();
  const path = leadPath(fd);
  const due = str(fd, "due_on");
  if (!isDate(due)) back(path, "Pick a date for the follow-up.");
  await addFollowup(await getDb(), str(fd, "lead_id"), due, str(fd, "note", 500));
  back(path);
}

export async function finishFollowup(fd: FormData): Promise<void> {
  await requireAdmin();
  const id = str(fd, "followup_id");
  if (isUuid(id)) await completeFollowup(await getDb(), id);
  back(str(fd, "return_to") === "list" ? "/admin/follow-ups" : leadPath(fd));
}

function readJob(fd: FormData): JobInput | string {
  const job_type = str(fd, "job_type") as JobType;
  const status = str(fd, "status") as JobStatus;
  if (!JOB_TYPES.includes(job_type) || !JOB_STATUSES.includes(status)) return "Choose a job type and status.";
  const scheduled = str(fd, "scheduled_on");
  const completed = str(fd, "completed_on");
  if (scheduled && !isDate(scheduled)) return "The scheduled date is not a date.";
  if (completed && !isDate(completed)) return "The completed date is not a date.";
  const revenue = parseDollars(str(fd, "revenue"));
  if (Number.isNaN(revenue)) return "Revenue should be a dollar amount like 4250 or 4,250.00.";
  const reportedBy = str(fd, "revenue_reported_by", 80);
  if (revenue !== null && !reportedBy) return "Say who reported the revenue number — it is a reported figure, not a measured one.";
  return {
    job_type,
    description: str(fd, "description", 300),
    status,
    scheduled_on: scheduled || null,
    completed_on: completed || (status === "completed" ? todayInBusinessTz() : null),
    reported_revenue_cents: revenue,
    revenue_reported_by: revenue === null ? "" : reportedBy,
    revenue_reported_on: revenue === null ? null : todayInBusinessTz(),
  };
}

export async function saveJob(fd: FormData): Promise<void> {
  await requireAdmin();
  const path = leadPath(fd);
  const leadId = str(fd, "lead_id");
  if (!isUuid(leadId)) back("/admin/leads", "That lead does not exist.");
  const job = readJob(fd);
  if (typeof job === "string") back(path, job);
  const jobId = str(fd, "job_id");
  const db = await getDb();
  if (jobId && isUuid(jobId)) await updateJob(db, jobId, job);
  else await addJob(db, leadId, job);
  back(path);
}

export async function overrideInfluence(fd: FormData): Promise<void> {
  await requireAdmin();
  const path = leadPath(fd);
  const influence = str(fd, "influence") as Influence;
  const who = str(fd, "who", 60);
  if (!INFLUENCES.includes(influence)) back(path, "Choose what influenced this lead.");
  if (!who) back(path, "Add your name so the change is on record.");
  await setInfluence(await getDb(), str(fd, "lead_id"), influence, slugify(str(fd, "campaign")), who);
  back(path);
}

export async function createManualLead(fd: FormData): Promise<void> {
  await requireAdmin();
  const influence = str(fd, "influence") as Influence;
  const who = str(fd, "who", 60);
  const parsed = parseLead(Object.fromEntries(fd.entries()), { phoneRequired: false });
  if (!parsed.ok) back("/admin/leads/new", Object.values(parsed.errors).join(" "));
  if (!INFLUENCES.includes(influence)) back("/admin/leads/new", "Choose what brought this lead in.");
  if (!who) back("/admin/leads/new", "Add your name so the entry is on record.");
  parsed.lead.last_touch = { ...EMPTY_TOUCH, utm_campaign: slugify(str(fd, "campaign")), at: new Date().toISOString() };
  parsed.lead.first_touch = null;
  const lead = await createLead(await getDb(), parsed.lead, {
    origin: "manual",
    influence: { influence, basis: `Entered by hand by ${who}` },
  });
  back(`/admin/leads/${lead.id}`);
}

export async function saveCampaign(fd: FormData): Promise<void> {
  await requireAdmin();
  const name = str(fd, "name", 120);
  const slug = slugify(str(fd, "slug") || name);
  const influence = str(fd, "influence") as Influence;
  const intent = str(fd, "intent");
  const starts = str(fd, "starts_on");
  const ends = str(fd, "ends_on");
  const spend = parseDollars(str(fd, "spend"));
  const spendBy = str(fd, "spend_reported_by", 80);
  const path = "/admin/campaigns";
  if (!name || slug.length < 2) back(path, "Give the campaign a name.");
  if (!["ad", "content", "referral", "review", "campaign"].includes(influence)) back(path, "Choose what kind of campaign this is.");
  if (!["", "replacement_estimate", "heating_service"].includes(intent)) back(path, "Choose a valid form preset.");
  if ((starts && !isDate(starts)) || (ends && !isDate(ends))) back(path, "Start and end must be dates.");
  if (Number.isNaN(spend)) back(path, "Spend should be a dollar amount.");
  if (spend !== null && !spendBy) back(path, "Say who reported the spend number.");
  const created = await createCampaign(await getDb(), {
    slug, name, influence,
    utm_source: slugify(str(fd, "utm_source", 60)),
    utm_medium: slugify(str(fd, "utm_medium", 60)).replace(/-/g, "_"),
    utm_content: slugify(str(fd, "utm_content", 60)),
    content_ref: str(fd, "content_ref", 120),
    ad_ref: str(fd, "ad_ref", 120),
    intent: intent as "" | "replacement_estimate" | "heating_service",
    starts_on: starts || null,
    ends_on: ends || null,
    reported_spend_cents: spend,
    spend_reported_by: spend === null ? "" : spendBy,
    notes: str(fd, "notes", 1000),
  });
  if (!created) back(path, `A campaign with the link name “${slug}” already exists. Pick a different name.`);
  back(path);
}

export async function editCampaign(fd: FormData): Promise<void> {
  await requireAdmin();
  const path = "/admin/campaigns";
  const spend = parseDollars(str(fd, "spend"));
  const spendBy = str(fd, "spend_reported_by", 80);
  if (Number.isNaN(spend)) back(path, "Spend should be a dollar amount.");
  if (spend !== null && !spendBy) back(path, "Say who reported the spend number.");
  await updateCampaign(await getDb(), str(fd, "campaign_id"), {
    active: fd.get("active") === "on",
    reported_spend_cents: spend,
    spend_reported_by: spend === null ? "" : spendBy,
    notes: str(fd, "notes", 1000),
  });
  back(path);
}
