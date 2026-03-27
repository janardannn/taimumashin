import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "noreply@taimumashin.com";
const MAX_LISTED_FILES = 5;

export async function sendRestoreEmail(
  to: string,
  folderPath: string,
  fileCount: number,
  keys: string[],
  expiresAt?: string | null
) {
  if (!resend) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const folder = folderPath === "/" ? "root" : folderPath;
  const filenames = keys.map((k) => k.split("/").pop() || k);

  // File list: show up to 5, then "+X more"
  const listed = filenames.slice(0, MAX_LISTED_FILES);
  const remaining = filenames.length - listed.length;
  const fileListHtml = filenames.length > 0
    ? `<ul style="margin:8px 0;padding-left:20px;color:#333">${listed.map((f) => `<li style="margin:4px 0;font-size:14px">${f}</li>`).join("")}${remaining > 0 ? `<li style="margin:4px 0;font-size:14px;color:#999">+${remaining} more</li>` : ""}</ul>`
    : "";

  const expiryLine = expiresAt
    ? `<p style="font-size:13px;color:#666">Files will remain available until <strong>${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong> before re-archiving.</p>`
    : "";

  const subject = fileCount === 1 && filenames[0]
    ? `Restore Complete: ${filenames[0]}`
    : `Restore Complete: ${fileCount} file${fileCount !== 1 ? "s" : ""} ready`;

  const heading = `<strong>${fileCount} file${fileCount !== 1 ? "s" : ""}</strong> in <strong>${folder}</strong> ${fileCount === 1 ? "is" : "are"} now available.`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px">
        <p style="font-size:15px">${heading}</p>
        ${fileListHtml}
        ${expiryLine}
        <p><a href="${appUrl}/${encodeURIComponent(folderPath === "/" ? "" : folderPath)}" style="color:#2563eb">Browse files</a></p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">taimumashin</p>
      </div>
    `,
  });
}
