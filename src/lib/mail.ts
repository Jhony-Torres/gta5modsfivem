import nodemailer from "nodemailer";
import { env } from "./env";

export function mailConfigured() {
  return env.smtp.configured;
}

export async function sendMail(to: string, subject: string, text: string) {
  if (!env.smtp.configured) throw new Error("SMTP não configurado.");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}
