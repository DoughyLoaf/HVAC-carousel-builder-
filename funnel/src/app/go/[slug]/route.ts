import { NextResponse } from "next/server";
import { EMPTY_TOUCH } from "@/lib/attribution";
import { getDb } from "@/lib/db";
import { clientIp, hashIp } from "@/lib/session";
import { getCampaignBySlug, recordTouchEvent } from "@/lib/store";
import { slugify } from "@/lib/validate";

/**
 * Short campaign link: /go/<slug> → the homepage with that campaign's tags.
 * Good for an Instagram bio, a QR code or a printed card. An unknown slug still
 * lands on the homepage and still tags the visit, so no lead goes untracked
 * because of a typo.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = slugify((await params).slug);
  const target = new URLSearchParams();
  let known = false;
  try {
    const db = await getDb();
    const campaign = slug ? await getCampaignBySlug(db, slug) : null;
    if (campaign) {
      known = true;
      if (campaign.utm_source) target.set("utm_source", campaign.utm_source);
      if (campaign.utm_medium) target.set("utm_medium", campaign.utm_medium);
      target.set("utm_campaign", campaign.slug);
      if (campaign.utm_content) target.set("utm_content", campaign.utm_content);
      if (campaign.intent) target.set("intent", campaign.intent);
      await recordTouchEvent(db, "go_redirect", "", {
        ...EMPTY_TOUCH,
        landing_path: `/go/${campaign.slug}`,
        referrer: (request.headers.get("referer") ?? "").slice(0, 500),
        utm_source: campaign.utm_source,
        utm_medium: campaign.utm_medium,
        utm_campaign: campaign.slug,
        utm_content: campaign.utm_content,
      }, hashIp(clientIp(request.headers)));
    }
  } catch (err) {
    console.error("[go] lookup failed:", err);
  }
  if (!known && slug) {
    target.set("utm_source", "go-link");
    target.set("utm_campaign", slug);
  }
  const query = target.toString();
  // A relative Location keeps the visitor on whatever host they came in on.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: query ? `/?${query}` : "/", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
