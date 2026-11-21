"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/misc";
import { randomToken, sha256 } from "@/lib/crypto";
import { mailConfigured, sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
import type { ActionState } from "@/components/forms";

const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido.").max(190);

function safeNext(n: FormDataEntryValue | null) {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/conta";
}

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 5, 60 * 60_000).ok) return { error: "Muitas tentativas. Tente novamente mais tarde." };
  const parsed = z
    .object({ name: z.string().trim().min(2, "Informe seu nome.").max(80), email: emailSchema, password: z.string() })
    .safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;
  const pwErr = passwordProblem(password);
  if (pwErr) return { error: pwErr };
  if (fd.get("password") !== fd.get("password2")) return { error: "As senhas não conferem." };
  if (fd.get("terms") !== "on") return { error: "É preciso aceitar os termos de uso e a política de privacidade." };
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { error: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha." };
  const user = await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await createSession(user.id);
  redirect(safeNext(fd.get("next")));
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 15 * 60_000).ok || !rateLimit(`login:${email}`, 8, 15 * 60_000).ok) {
    return { error: "Muitas tentativas de login. Aguarde alguns minutos." };
  }
  const user = await prisma.user.findUnique({ where: { email } });
  // Mesmo tempo de resposta mesmo se o usuário não existir
  if (!user) {
    await hashPassword(password);
    return { error: "E-mail ou senha incorretos." };
  }
  if (!(await verifyPassword(password, user.passwordHash))) return { error: "E-mail ou senha incorretos." };
  if (user.status !== "ACTIVE") return { error: "Esta conta está bloqueada. Fale com o suporte." };
  await createSession(user.id);
  redirect(safeNext(fd.get("next")));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!mailConfigured()) return { error: "A recuperação de senha por e-mail ainda não está disponível. Fale com o suporte." };
  const ip = await clientIp();
  if (!rateLimit(`forgot:${ip}`, 5, 60 * 60_000).ok) return { error: "Muitas solicitações. Tente mais tarde." };
  const parsed = emailSchema.safeParse(fd.get("email"));
  if (!parsed.success) return { error: "E-mail inválido." };
  const user = await prisma.user.findUnique({ where: { email: parsed.data } });
  if (user && user.status === "ACTIVE") {
    const token = randomToken(32);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60_000) },
    });
    try {
      await sendMail(
        user.email,
        "Redefinição de senha — Palmas TO",
        `Olá, ${user.name}.\n\nPara criar uma nova senha, acesse o link abaixo (válido por 1 hora):\n${env.appUrl}/redefinir-senha?token=${token}\n\nSe você não pediu, ignore este e-mail.`,
      );
    } catch (e) {
      console.error("[mail]", e);
      return { error: "Não foi possível enviar o e-mail agora. Tente mais tarde." };
    }
  }
  return { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const token = String(fd.get("token") || "");
  const password = String(fd.get("password") || "");
  const pwErr = passwordProblem(password);
  if (pwErr) return { error: pwErr };
  if (password !== fd.get("password2")) return { error: "As senhas não conferem." };
  const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) return { error: "Link inválido ou expirado. Solicite outro." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordResetToken.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: rec.userId } }),
  ]);
  return { ok: true, message: "Senha alterada. Você já pode entrar com a nova senha." };
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login novamente." };
  const name = String(fd.get("name") || "").trim();
  if (name.length < 2 || name.length > 80) return { error: "Nome inválido." };
  const email = emailSchema.safeParse(fd.get("email"));
  if (!email.success) return { error: "E-mail inválido." };
  if (email.data !== user.email) {
    const cur = String(fd.get("currentPassword") || "");
    const db = await prisma.user.findUnique({ where: { id: user.id } });
    if (!db || !(await verifyPassword(cur, db.passwordHash))) return { error: "Para alterar o e-mail, confirme sua senha atual." };
    if (await prisma.user.findUnique({ where: { email: email.data } })) return { error: "Este e-mail já está em uso." };
  }
  await prisma.user.update({ where: { id: user.id }, data: { name, email: email.data } });
  return { ok: true, message: "Dados atualizados." };
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login novamente." };
  const db = await prisma.user.findUnique({ where: { id: user.id } });
  if (!db || !(await verifyPassword(String(fd.get("currentPassword") || ""), db.passwordHash))) return { error: "Senha atual incorreta." };
  const pw = String(fd.get("password") || "");
  const pwErr = passwordProblem(pw);
  if (pwErr) return { error: pwErr };
  if (pw !== fd.get("password2")) return { error: "As senhas não conferem." };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(pw) } });
  return { ok: true, message: "Senha alterada." };
}
