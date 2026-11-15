import { describe, expect, it } from "vitest";
import { leadSummaryText, notifyNewLead } from "@/lib/notify";
import type { Lead } from "@/lib/store";

const lead = {
  id: "11111111-2222-4333-8444-555555555555", created_at: new Date("2026-11-15T18:00:00Z"), origin: "web_form",
  request_type: "heating_service", urgency: "urgent", town: "Hayden", zip: "83835", message: "Furnace clicks but no heat.",
  name: "Kim Ortiz", phone: "(208) 555-0142", email: "kim@example.com", preferred_contact: "text",
  influence: "content", utm_campaign: "carousel-4", self_reported_source: "Instagram",
} as unknown as Lead;

function fakeFetch(respond: (url: string) => Response | Error) {
  const calls: { url: string; headers: Record<string, string>; body: any }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) });
    const r = respond(url);
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("notifyNewLead", () => {
  it("says so when nothing is configured, and calls nobody", async () => {
    const { impl, calls } = fakeFetch(() => new Response("{}"));
    const results = await notifyNewLead(lead, {}, impl);
    expect(results).toEqual([expect.objectContaining({ channel: "none", status: "not_configured" })]);
    expect(calls).toHaveLength(0);
  });

  it("needs all three email settings before it tries email", async () => {
    const { impl, calls } = fakeFetch(() => new Response("{}"));
    const results = await notifyNewLead(lead, { resendApiKey: "k", emailTo: "office@example.com" }, impl);
    expect(results[0].status).toBe("not_configured");
    expect(calls).toHaveLength(0);
  });

  it("sends email and webhook, with the lead's details and an admin link", async () => {
    const { impl, calls } = fakeFetch(() => new Response("{}"));
    const results = await notifyNewLead(lead, {
      resendApiKey: "re_key", emailTo: "office@example.com, owner@example.com", emailFrom: "Leads <leads@example.com>",
      webhookUrl: "https://hooks.example.com/x", siteUrl: "https://go.example.com/",
    }, impl);
    expect(results.map((r) => `${r.channel}:${r.status}`)).toEqual(["email:sent", "webhook:sent"]);

    const email = calls[0];
    expect(email.url).toBe("https://api.resend.com/emails");
    expect(email.headers.Authorization).toBe("Bearer re_key");
    expect(email.body.to).toEqual(["office@example.com", "owner@example.com"]);
    expect(email.body.subject).toBe("New request: Heating service — Kim Ortiz (NO HEAT NOW)");
    expect(email.body.reply_to).toBe("kim@example.com");
    expect(email.body.text).toContain("Phone: (208) 555-0142");
    expect(email.body.text).toContain("https://go.example.com/admin/leads/11111111-2222-4333-8444-555555555555");

    const hook = calls[1];
    expect(hook.body.event).toBe("lead.created");
    expect(hook.body.lead.phone).toBe("(208) 555-0142");
    expect(hook.body.text).toContain("Kim Ortiz");
  });

  it("reports a rejected email and still tries the webhook", async () => {
    const { impl } = fakeFetch((url) => url.includes("resend") ? new Response("bad key", { status: 401 }) : new Response("ok"));
    const results = await notifyNewLead(lead, { resendApiKey: "k", emailTo: "a@example.com", emailFrom: "b@example.com", webhookUrl: "https://h.example.com" }, impl);
    expect(results[0]).toEqual({ channel: "email", status: "failed", detail: "HTTP 401: bad key" });
    expect(results[1].status).toBe("sent");
  });

  it("a network failure is a failed attempt, not a crash", async () => {
    const { impl } = fakeFetch(() => new Error("connect ECONNREFUSED"));
    const results = await notifyNewLead(lead, { webhookUrl: "https://h.example.com" }, impl);
    expect(results).toEqual([{ channel: "webhook", status: "failed", detail: "connect ECONNREFUSED" }]);
  });

  it("the summary leaves out what was not given", () => {
    const text = leadSummaryText({ ...lead, email: "", message: "", town: "", zip: "", self_reported_source: "", utm_campaign: "" } as Lead);
    expect(text).not.toContain("Email:");
    expect(text).not.toContain("Where:");
    expect(text).not.toContain("\n\n\n");
  });
});
