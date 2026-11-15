import type { MetadataRoute } from "next";
import { siteMode } from "@/lib/launch";

export default function robots(): MetadataRoute.Robots {
  return siteMode() === "live"
    ? { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/go"] }] }
    : { rules: [{ userAgent: "*", disallow: "/" }] };
}
