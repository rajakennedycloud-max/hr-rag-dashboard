import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function getAuthSession() {
  return getServerSession(authOptions);
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized", message: "You must be logged in to access this resource" },
    { status: 401 }
  );
}

export const WRITE_ROLES = ["TA_SPECIALIST", "ADMIN"] as const;

export function requireRole(
  session: { user: { role?: string } },
  roles: readonly string[]
): NextResponse | null {
  if (!roles.includes(session.user.role ?? "")) return forbiddenResponse();
  return null;
}

export function forbiddenResponse(reason?: string) {
  return NextResponse.json(
    { error: "Forbidden", message: reason || "You do not have permission to perform this action" },
    { status: 403 }
  );
}
