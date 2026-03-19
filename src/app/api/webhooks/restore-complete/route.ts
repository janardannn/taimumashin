import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

async function verifySignature(
  body: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] WEBHOOK_SECRET not configured");
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature") || "";

  if (!(await verifySignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const body = JSON.parse(rawBody);
  const { userId, folderPath, expiresAt } = body;

  if (!userId || !folderPath) {
    return NextResponse.json(
      { error: "Missing userId or folderPath" },
      { status: 400 }
    );
  }

  const prisma = await getPrisma();

  await prisma.restoreJob.updateMany({
    where: {
      userId,
      folderPath,
      status: "RESTORING",
    },
    data: {
      status: "READY",
      restoredAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ success: true });
}
