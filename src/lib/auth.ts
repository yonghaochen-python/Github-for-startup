import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt);
  return `${toHex(salt.buffer)}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const candidate = await pbkdf2(password, fromHex(saltHex));
  return candidate === hashHex;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(digest);
}

function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

export type SessionUser = { id: string; email: string };

export async function createSession(userId: string): Promise<{ cookie: string; expiresAt: Date }> {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { tokenHash, userId, expiresAt } });

  return { cookie: token, expiresAt };
}

export function sessionCookieHeader(token: string, expiresAt: Date): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Expires=${expiresAt.toUTCString()}`,
  ].join("; ");
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  const tokenHash = await sha256Hex(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getCurrentUser(request: Request): Promise<SessionUser | null> {
  const token = readSessionToken(request);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;

  return { id: session.user.id, email: session.user.email };
}

/** Returns the signed-in user, or throws a 401 Response for the route handler to return directly. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Not signed in." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return user;
}
