import { INFLUENCE_LABEL } from "./attribution";
import type { Lead } from "./store";
import { REQUEST_LABEL, URGENCY_LABEL } from "./validate";

export interface NotifyResult {
  channel: "email" | "webhook" | "none";
  status: "sent" | "failed" | "not_configured";
  detail: string;
}

export interface NotifyConfig {
  resendApiKey?: string;
  emailTo?: string;
  emailFrom?: string;
  webhookUrl?: string;
  /** Public address of the site, for the admin link in the alert. */
  siteUrl?: string;
}

export function notifyConfigFromEnv(env: NodeJS.ProcessEnv = process.env): NotifyConfig {
  return {
    resendApiKey: env.RESEND_API_KEY?.trim() || undefined,
    emailTo: env.LEAD_NOTIFY_EMAIL_TO?.trim() || undefined,
    emailFrom: env.LEAD_NOTIFY_EMAIL_FROM?.trim() || undefined,
    webhookUrl: env.LEAD_NOTIFY_WEBHOOK_URL?.trim() || undefined,
    siteUrl: env.SITE_URL?.trim() || undefined,
  };
}

export function emailConfigured(c: NotifyConfig): boolean {
  return Boolean(c.resendApiKey && c.emailTo && c.emailFrom);
}

export function describeChannels(c: NotifyConfig): { email: boolean; webhook: boolean } {
  return { email: emailConfigured(c), webhook: Boolean(c.webhookUrl) };
}

export function leadSummaryText(lead: Lead, siteUrl?: string): string {
  const lines = [
    `${REQUEST_LABEL[lead.request_type]}${lead.urgency ? ` — ${URGENCY_LABEL[lead.urgency]}` : ""}`,
    "",
    `Name:  ${lead.name}`,
    `Phone: ${lead.phone || "not given"}`,
    lead.email ? `Email: ${lead.email}` : "",
    `Prefers: ${lead.preferred_contact === "either" ? "call or text" : lead.preferred_contact}`,
    lead.town || lead.zip ? `Where: ${[lead.town, lead.zip].filter(Boolean).join(" ")}` : "",
    lead.message ? `\nThey wrote:\n${lead.message}` : "",
    "",
    `Came from: ${INFLUENCE_LABEL[lead.influence]}${lead.utm_campaign ? ` (campaign: ${lead.utm_campaign})` : ""}`,
    lead.self_reported_source ? `They said they heard about CDA from: ${lead.self_reported_source}` : "",
    siteUrl ? `\nOpen in the admin: ${siteUrl.replace(/\/$/, "")}/admin/leads/${lead.id}` : "",
  ];
  return lines.filter((l, i, all) => l !== "" || all[i - 1] !== "").join("\n").trim();
}

async function post(fetchImpl: typeof fetch, url: string, headers: Record<string, string>, body: unknown): Promise<string | null> {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) return null;
    const text = await res.text().catch(() => "");
    return `HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}`;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Sends the "new lead" alert on every configured channel. Never throws: the
 * lead is already saved by the time this runs, and each attempt's outcome is
 * returned so it can be recorded and shown in the admin.
 */
export async function notifyNewLead(lead: Lead, config: NotifyConfig, fetchImpl: typeof fetch = fetch): Promise<NotifyResult[]> {
  const results: NotifyResult[] = [];
  const text = leadSummaryText(lead, config.siteUrl);
  const subject = `New request: ${REQUEST_LABEL[lead.request_type]} — ${lead.name}${lead.urgency === "urgent" ? " (NO HEAT NOW)" : ""}`;

  if (emailConfigured(config)) {
    const to = config.emailTo!.split(",").map((s) => s.trim()).filter(Boolean);
    const error = await post(fetchImpl, "https://api.resend.com/emails", { Authorization: `Bearer ${config.resendApiKey}` }, {
      from: config.emailFrom,
      to,
      subject,
      text,
      ...(lead.email ? { reply_to: lead.email } : {}),
    });
    results.push(error
      ? { channel: "email", status: "failed", detail: error }
      : { channel: "email", status: "sent", detail: `Emailed ${to.length} recipient${to.length === 1 ? "" : "s"}` });
  }

  if (config.webhookUrl) {
    // `text` makes this payload work as-is with a Slack incoming webhook; the
    // structured fields are there for Zapier / Make / an SMS relay.
    const error = await post(fetchImpl, config.webhookUrl, {}, {
      text: `*${subject}*\n${text}`,
      event: "lead.created",
      lead: {
        id: lead.id,
        created_at: lead.created_at,
        request_type: lead.request_type,
        urgency: lead.urgency,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        town: lead.town,
        zip: lead.zip,
        message: lead.message,
        influence: lead.influence,
        utm_campaign: lead.utm_campaign,
      },
    });
    results.push(error
      ? { channel: "webhook", status: "failed", detail: error }
      : { channel: "webhook", status: "sent", detail: "Webhook accepted the alert" });
  }

  if (results.length === 0) {
    results.push({ channel: "none", status: "not_configured", detail: "No email or webhook is set up, so nobody was alerted. The lead is saved." });
  }
  return results;
}
