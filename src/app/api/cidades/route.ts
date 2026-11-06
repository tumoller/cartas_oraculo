import { NextRequest, NextResponse } from "next/server";
import { searchCities } from "@/lib/cities";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 60);
  return NextResponse.json({ cities: searchCities(q, 8) });
}
