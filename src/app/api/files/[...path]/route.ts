import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join, resolve, sep, basename, extname } from "path";
import { getAuthSession, unauthorizedResponse } from "@/lib/api-auth";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getAuthSession();
  if (!session) return unauthorizedResponse();

  const uploadsDir = join(process.cwd(), "uploads");
  const resolved = resolve(uploadsDir, ...(params.path ?? []));

  if (resolved !== uploadsDir && !resolved.startsWith(uploadsDir + sep)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!existsSync(resolved)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = await readFile(resolved);
  const contentType =
    CONTENT_TYPES[extname(resolved).toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${basename(resolved)}"`,
    },
  });
}
