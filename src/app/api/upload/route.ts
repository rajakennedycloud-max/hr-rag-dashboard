import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join, resolve, basename, sep } from "path";
import { existsSync } from "fs";
import { getAuthSession, unauthorizedResponse, requireRole, WRITE_ROLES } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'text/plain'
];

const MAGIC_BYTES: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'application/msword': [0xd0, 0xcf, 0x11, 0xe0],
  'application/vnd.ms-excel': [0xd0, 0xcf, 0x11, 0xe0],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4b, 0x03, 0x04], // PK zip
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4b, 0x03, 0x04],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
};

function magicBytesValid(buffer: Buffer, mime: string): boolean {
  const sig = MAGIC_BYTES[mime];
  if (!sig) return true; // no signature defined (e.g. text/plain)
  if (buffer.length < sig.length) return false;
  return sig.every((b, i) => buffer[i] === b);
}

function uploadsDir() {
  return join(process.cwd(), 'uploads');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const roleError = requireRole(session, WRITE_ROLES);
    if (roleError) return roleError;

    const data = await req.formData();
    const file: File | null = data.get('file') as unknown as File;
    const candidateId: string = data.get('candidateId') as string;
    const fileType: string = data.get('fileType') as string; // resignationProof, kycDocuments, resume, general

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!candidateId) {
      return NextResponse.json({ error: 'Candidate ID is required' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TXT' 
      }, { status: 400 });
    }

    // Verify candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Create uploads directory if it doesn't exist
    const dir = uploadsDir();
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;
    const filePath = join(dir, fileName);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (!magicBytesValid(buffer, file.type)) {
      return NextResponse.json(
        { error: 'File contents do not match the declared file type' },
        { status: 400 }
      );
    }
    await writeFile(filePath, buffer);

    // Save file path to database based on file type
    const relativeFilePath = `/api/files/${fileName}`;
    let updateData: any = {};

    switch (fileType) {
      case 'resignationProof':
        updateData = { resignationProofFile: relativeFilePath };
        break;
      case 'kycDocuments':
        updateData = { kycDocumentsFile: relativeFilePath };
        break;
      case 'resume':
        updateData = { resumeFile: relativeFilePath };
        break;
      case 'general':
        // Save to attachments table
        await prisma.attachment.create({
          data: {
            candidateId,
            fileName: file.name,
            filePath: relativeFilePath,
            fileSize: file.size,
            mimeType: file.type,
            uploadedBy: session.user.id
          }
        });
        break;
      default:
        return NextResponse.json({ error: 'Invalid file type specified' }, { status: 400 });
    }

    // Update candidate if not general attachment
    if (fileType !== 'general') {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: updateData
      });
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      filePath: relativeFilePath,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorizedResponse();
    const roleError = requireRole(session, WRITE_ROLES);
    if (roleError) return roleError;

    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('filePath');
    const candidateId = searchParams.get('candidateId');
    const fileType = searchParams.get('fileType');

    if (!filePath || !candidateId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId }
    });

    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }

    // Remove file from database
    let updateData: any = {};
    switch (fileType) {
      case 'resignationProof':
        updateData = { resignationProofFile: null };
        break;
      case 'kycDocuments':
        updateData = { kycDocumentsFile: null };
        break;
      case 'resume':
        updateData = { resumeFile: null };
        break;
      case 'general':
        // Delete from attachments table
        await prisma.attachment.deleteMany({
          where: { 
            candidateId, 
            filePath 
          }
        });
        break;
      default:
        return NextResponse.json({ error: 'Invalid file type specified' }, { status: 400 });
    }

    if (fileType !== 'general') {
      await prisma.candidate.update({
        where: { id: candidateId },
        data: updateData
      });
    }

    // Delete the physical file (guarded against path traversal)
    const resolved = resolve(uploadsDir(), basename(filePath));
    if (resolved.startsWith(uploadsDir() + sep)) {
      try {
        await unlink(resolved);
      } catch (e: any) {
        if (e?.code !== 'ENOENT') throw e;
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('File deletion error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}
