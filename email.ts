/**
 * Generic email helpers built on nodemailer.
 * Intended for transactional emails (receipts, notifications, invites).
 */
import nodemailer from "nodemailer";
import { ENV } from "./_core/env";

function createTransport() {
  return nodemailer.createTransport({
    host: ENV.smtpHost,
    port: ENV.smtpPort,
    secure: ENV.smtpPort === 465,
    auth: ENV.smtpUser && ENV.smtpPass
      ? { user: ENV.smtpUser, pass: ENV.smtpPass }
      : undefined,
  });
}

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Send a transactional email.
 * Returns true on success, false if SMTP is not configured or delivery fails.
 */
export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  if (!ENV.smtpPass && !ENV.smtpHost) {
    console.warn("[Email] SMTP not configured — skipping email to", opts.to);
    return false;
  }

  try {
    const transport = createTransport();
    await transport.sendMail({
      from: ENV.smtpFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    return true;
  } catch (err) {
    console.error("[Email] Failed to send to", opts.to, err);
    return false;
  }
}
