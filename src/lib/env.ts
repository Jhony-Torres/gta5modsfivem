import path from "node:path";

function num(v: string | undefined, d: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get appSecret() {
    const s = process.env.APP_SECRET || "";
    if (s.length < 32) throw new Error("APP_SECRET ausente ou curto demais (mínimo 32 caracteres). Configure no .env.");
    return s;
  },
  get publicDir() {
    return path.resolve(process.env.STORAGE_PUBLIC_DIR || "./storage/public");
  },
  get privateDir() {
    return path.resolve(process.env.STORAGE_PRIVATE_DIR || "./storage/private");
  },
  get maxFileBytes() {
    return num(process.env.MAX_FILE_UPLOAD_MB, 1024) * 1024 * 1024;
  },
  get maxImageBytes() {
    return num(process.env.MAX_IMAGE_UPLOAD_MB, 8) * 1024 * 1024;
  },
  get downloadTtl() {
    return num(process.env.DOWNLOAD_LINK_TTL_SECONDS, 600);
  },
  get trustProxy() {
    return process.env.TRUST_PROXY === "true";
  },
  infinitepay: {
    get handle() {
      return (process.env.INFINITEPAY_HANDLE || "").replace(/^\$/, "").trim();
    },
    get apiKey() {
      return (process.env.INFINITEPAY_API_KEY || "").trim();
    },
    get apiBase() {
      return (process.env.INFINITEPAY_API_BASE || "https://api.checkout.infinitepay.io").replace(/\/$/, "");
    },
    get linkTtlMinutes() {
      return num(process.env.INFINITEPAY_LINK_TTL_MINUTES, 60);
    },
    get enabled() {
      return process.env.INFINITEPAY_ENABLED === "true";
    },
  },
  smtp: {
    get configured() {
      return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
    },
  },
};
