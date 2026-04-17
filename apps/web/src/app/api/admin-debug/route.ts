import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = await auth();
  const adminId = process.env.ADMIN_CLERK_USER_ID;

  return NextResponse.json({
    clerkUserId: userId,
    adminEnvVar: adminId ?? "(not set)",
    match: userId === adminId,
    envKeys: Object.keys(process.env).filter(k => k.includes("ADMIN")),
  });
}
