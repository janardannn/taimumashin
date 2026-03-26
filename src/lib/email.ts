import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@taimumashin.com";

export async function sendRestoreEmail(
  to: string,
  folderPath: string,
  fileCount: number,
  expiresAt?: string | null
) {
  if (!resend) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const folder = folderPath === "/" ? "root" : folderPath;
  const expiryLine = expiresAt
    ? `<p>Files will remain available until <strong>${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong> before re-archiving.</p>`
    : "";

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `Restore Complete: ${fileCount} file${fileCount !== 1 ? "s" : ""} ready`,
    html: `
      <div style="font-family:sans-serif;max-width:480px">
        <p>Your restore request is complete.</p>
        <p><strong>${fileCount} file${fileCount !== 1 ? "s" : ""}</strong> in <strong>${folder}</strong> are now available for download.</p>
        ${expiryLine}
        <p><a href="${appUrl}/${encodeURIComponent(folderPath === "/" ? "" : folderPath)}">Browse files</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">taimumashin</p>
      </div>
    `,
  });
}
