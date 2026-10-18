type TurnstileResult = {
  success?: boolean;
  hostname?: string;
  "error-codes"?: string[];
};

function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export async function verifyTurnstile(request: Request, token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) {
    throw new Error("Human verification is not configured for Art Drops.");
  }
  if (!token) throw new Error("Complete the human verification before claiming.");

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  const address = clientAddress(request);
  if (address) form.set("remoteip", address);

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form, cache: "no-store" }
  );
  const result = (await response.json().catch(() => ({}))) as TurnstileResult;
  if (!response.ok || !result.success) {
    throw new Error("Human verification failed. Refresh it and try again.");
  }

  if (process.env.NODE_ENV === "production") {
    const expectedHostname = new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://adbidcoin.com"
    ).hostname;
    if (result.hostname !== expectedHostname) {
      throw new Error("Human verification was issued for a different site.");
    }
  }
}
