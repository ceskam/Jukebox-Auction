import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const WALLET_CHALLENGE_COOKIE = "attention_bid_wallet_challenge";
export const WALLET_SESSION_COOKIE = "attention_bid_wallet_session";
export const ADMIN_SESSION_COOKIE = "attention_bid_admin_session";

const WALLET_SESSION_TTL_SECONDS = 24 * 60 * 60;
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;

type WalletChallenge = {
  wallet: string;
  nonce: string;
  expiresAt: number;
};

type WalletSession = {
  wallet: string;
  expiresAt: number;
};

type AdminSession = {
  role: "admin";
  expiresAt: number;
};

function getSigningSecret() {
  const secret = process.env.WALLET_AUTH_SECRET ?? process.env.ADMIN_TOKEN;

  if (!secret || secret.length < 32) {
    throw new Error(
      "Set WALLET_AUTH_SECRET (recommended) or a strong ADMIN_TOKEN with at least 32 characters."
    );
  }

  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function createSignedToken(payload: object) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifySignedToken<T>(token?: string | null): T | undefined {
  if (!token) return undefined;

  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return undefined;

  const expectedSignature = sign(encodedPayload);
  const suppliedBytes = Buffer.from(suppliedSignature);
  const expectedBytes = Buffer.from(expectedSignature);

  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return undefined;
  }

  try {
    return JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as T;
  } catch {
    return undefined;
  }
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return undefined;
}

export function createWalletChallenge(wallet: string) {
  const challenge: WalletChallenge = {
    wallet,
    nonce: randomBytes(24).toString("base64url"),
    expiresAt: Date.now() + CHALLENGE_TTL_SECONDS * 1000,
  };

  return {
    challenge,
    message: buildWalletChallengeMessage(challenge),
    token: createSignedToken(challenge),
  };
}

export function buildWalletChallengeMessage(challenge: WalletChallenge) {
  return [
    "Attention Bid wallet authentication",
    "",
    `Wallet: ${challenge.wallet}`,
    `Nonce: ${challenge.nonce}`,
    `Expires: ${new Date(challenge.expiresAt).toISOString()}`,
    "",
    "Signing proves wallet ownership. It does not authorize a transaction or fee.",
  ].join("\n");
}

export function getWalletChallenge(request: Request) {
  const challenge = verifySignedToken<WalletChallenge>(
    readCookie(request, WALLET_CHALLENGE_COOKIE)
  );

  if (!challenge || challenge.expiresAt <= Date.now()) {
    return undefined;
  }

  return challenge;
}

export function createWalletSessionToken(wallet: string) {
  return createSignedToken({
    wallet,
    expiresAt: Date.now() + WALLET_SESSION_TTL_SECONDS * 1000,
  } satisfies WalletSession);
}

export function getWalletFromSessionToken(token?: string | null) {
  const session = verifySignedToken<WalletSession>(token);

  if (!session || !session.wallet || session.expiresAt <= Date.now()) {
    return "";
  }

  return session.wallet;
}

export function getAuthenticatedWallet(request: Request) {
  return getWalletFromSessionToken(readCookie(request, WALLET_SESSION_COOKIE));
}

export function createAdminSessionToken() {
  return createSignedToken({
    role: "admin",
    expiresAt: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000,
  } satisfies AdminSession);
}

export function hasAdminSession(request: Request) {
  const session = verifySignedToken<AdminSession>(
    readCookie(request, ADMIN_SESSION_COOKIE)
  );

  return Boolean(
    session?.role === "admin" && session.expiresAt > Date.now()
  );
}

export function verifyAdminToken(candidate: string) {
  const expected = process.env.ADMIN_TOKEN ?? "";
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);

  return Boolean(
    expected.length >= 32 &&
      candidateBytes.length === expectedBytes.length &&
      timingSafeEqual(candidateBytes, expectedBytes)
  );
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export const walletChallengeCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: CHALLENGE_TTL_SECONDS,
};

export const walletSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: WALLET_SESSION_TTL_SECONDS,
};

export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: ADMIN_SESSION_TTL_SECONDS,
};
