import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const validReadingId = (id: string) => /^[a-f0-9-]{36}$/i.test(id);

function signature(id: string): string {
  const secret = process.env.ORACLE_ACCESS_SECRET;
  if (!secret) throw new Error("ORACLE_ACCESS_SECRET não configurado.");
  return createHmac("sha256", secret).update(`reading:${id}`).digest("hex");
}

export function requireReadingAccess(req: NextRequest, id: string): boolean {
  if (!validReadingId(id)) return false;
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin) {
    // Next may construct nextUrl with its bind host (0.0.0.0); browsers send the actual LAN host.
    try { if (new URL(origin).host !== (req.headers.get("host") || req.nextUrl.host)) return false; }
    catch { return false; }
  }
  const token = req.cookies.get(`oracle_${id}`)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  return timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(signature(id), "hex"));
}

export function grantReadingAccess(response: NextResponse, req: NextRequest, id: string) {
  response.cookies.set(`oracle_${id}`, signature(id), {
    httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
