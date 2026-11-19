import { randomToken, sha256Hex } from "@/lib/auth";

/**
 * Sign in with Google (OpenID Connect, the code flow with PKCE), straight with Google: no extra service in between.
 *
 * 1. /api/auth/google/start sends the person to Google with a one-time `state` and a PKCE challenge, both remembered in
 *    a short-lived, http-only cookie on this site.
 * 2. Google sends them back to /api/auth/google/callback with a code. The state must match the cookie (so nobody can
 *    finish a sign-in someone else started), and the code is swapped for Google's id token server to server, with the
 *    client secret and the PKCE verifier (so a stolen code is useless).
 * 3. The id token says who they are. It came straight from Google's token endpoint over HTTPS, so per OpenID Connect
 *    its signature needn't be checked again; its audience (this app), issuer (Google), expiry and "email verified"
 *    still are.
 *
 * Virm only asks for the basics (openid, email, profile): the person's Google id, email and name. Never their password.
 * Off unless GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 */

export const GOOGLE_COOKIE = "virm_google";
const COOKIE_MAX_AGE = 10 * 60;

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const googleSignInOn = () => googleConfig() !== null;

/** Where Google sends people back to: this site's own address (works on the live site and on this computer). */
export const callbackUrl = (request: Request) => `${new URL(request.url).origin}/api/auth/google/callback`;

/** Only this site's own pages (never another site, never "//elsewhere"). */
export function safeNext(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value.slice(0, 300) : "/";
}

const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

type Pending = { state: string; verifier: string; next: string; invite: string };

/** The start of a sign-in: Google's address to send the person to, and the cookie remembering this attempt. */
export async function startSignIn(request: Request, next: string, invite: string): Promise<{ url: string; cookie: string } | null> {
  const config = googleConfig();
  if (!config) return null;
  const state = randomToken();
  const verifier = randomToken() + randomToken();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const pending: Pending = { state, verifier, next: safeNext(next), invite: invite.slice(0, 40) };
  const value = encodeURIComponent(JSON.stringify(pending));
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return { url: url.toString(), cookie: `${GOOGLE_COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=${COOKIE_MAX_AGE}${secure}` };
}

export const clearGoogleCookie = () => `${GOOGLE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/auth/google; Max-Age=0`;

export function readPending(request: Request): Pending | null {
  const raw = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${GOOGLE_COOKIE}=`))
    ?.slice(GOOGLE_COOKIE.length + 1);
  if (!raw) return null;
  try {
    const p = JSON.parse(decodeURIComponent(raw)) as Partial<Pending>;
    return typeof p.state === "string" && typeof p.verifier === "string"
      ? { state: p.state, verifier: p.verifier, next: safeNext(p.next), invite: typeof p.invite === "string" ? p.invite : "" }
      : null;
  } catch {
    return null;
  }
}

/** Constant-time comparison of the returned state with the remembered one. */
export async function sameState(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0 && x.length === y.length;
}

export type GoogleProfile = { sub: string; email: string; name: string | null };

/** Swaps Google's code for who the person is. Throws a plain message on anything unexpected. */
export async function finishSignIn(request: Request, code: string, verifier: string): Promise<GoogleProfile> {
  const config = googleConfig();
  if (!config) throw new Error("Google sign-in isn't set up.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: callbackUrl(request),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  }).catch(() => null);
  if (!res?.ok) throw new Error("Google didn't confirm the sign-in. Please try again.");
  const { id_token: idToken } = (await res.json().catch(() => ({}))) as { id_token?: string };
  const payloadPart = idToken?.split(".")[1];
  if (!payloadPart) throw new Error("Google didn't confirm the sign-in. Please try again.");
  const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))) as {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    given_name?: string;
  };
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") throw new Error("That sign-in wasn't from Google.");
  if (claims.aud !== config.clientId) throw new Error("That sign-in wasn't for Virm.");
  if (!claims.exp || claims.exp * 1000 < Date.now()) throw new Error("That sign-in expired. Please try again.");
  if (!claims.sub || !claims.email) throw new Error("Google didn't share an email. Please try again.");
  if (claims.email_verified !== true && claims.email_verified !== "true") throw new Error("Your Google email isn't verified yet, so it can't be used to sign in.");
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), name: (claims.given_name || claims.name || "").trim() || null };
}
