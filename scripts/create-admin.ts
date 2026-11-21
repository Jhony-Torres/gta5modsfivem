/**
 * Cria (ou promove) o primeiro administrador de forma segura, sem senha fixa no código.
 *   npm run admin:create -- --email voce@exemplo.com --name "Jhony"
 * A senha é pedida no terminal (não aparece na tela nem no histórico).
 * Também aceita ADMIN_PASSWORD no ambiente para automação (evite em uso normal).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import readline from "node:readline";

const prisma = new PrismaClient();

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function askHidden(q: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let muted = false;
    out._writeToOutput = (s: string) => {
      if (!muted) out.output.write(s);
    };
    rl.question(q, (a) => {
      rl.close();
      process.stdout.write("\n");
      resolve(a);
    });
    muted = true;
  });
}

async function main() {
  const email = (arg("email") || "").trim().toLowerCase();
  const name = (arg("name") || "Administrador").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Uso: npm run admin:create -- --email voce@exemplo.com --name "Seu nome"');
    process.exit(1);
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: "ADMIN", status: "ACTIVE" } });
    console.log(`Usuário ${email} promovido a administrador (senha mantida).`);
    return;
  }
  let password = process.env.ADMIN_PASSWORD || "";
  if (!password) {
    password = await askHidden("Senha do administrador (mín. 12 caracteres): ");
    const again = await askHidden("Repita a senha: ");
    if (password !== again) {
      console.error("As senhas não conferem.");
      process.exit(1);
    }
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    console.error("Senha fraca: use ao menos 12 caracteres com letras e números.");
    process.exit(1);
  }
  await prisma.user.create({ data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`Administrador ${email} criado. Acesse /entrar e depois /admin.`);
}

main().finally(() => prisma.$disconnect());
