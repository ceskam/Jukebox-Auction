import { createHmac, randomBytes } from "node:crypto";

function encode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function credentials() {
  const values = {
    consumerKey: process.env.X_API_KEY ?? "",
    consumerSecret: process.env.X_API_SECRET ?? "",
    accessToken: process.env.X_ACCESS_TOKEN ?? "",
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET ?? "",
  };
  if (Object.values(values).some((value) => !value)) throw new Error("X publishing credentials are incomplete.");
  return values;
}

function oauthHeader(method: string, url: string, bodyParams: Record<string, string> = {}) {
  const auth = credentials();
  const oauth: Record<string, string> = {
    oauth_consumer_key: auth.consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: auth.accessToken,
    oauth_version: "1.0",
  };
  const entries = Object.entries({ ...oauth, ...bodyParams })
    .map(([key, value]) => [encode(key), encode(value)] as const)
    .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));
  const parameterString = entries.map(([key, value]) => `${key}=${value}`).join("&");
  const base = [method.toUpperCase(), encode(url), encode(parameterString)].join("&");
  const key = `${encode(auth.consumerSecret)}&${encode(auth.accessSecret)}`;
  oauth.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
  return `OAuth ${Object.entries(oauth).sort().map(([key, value]) => `${encode(key)}="${encode(value)}"`).join(", ")}`;
}

async function uploadMedia(bytes: Buffer) {
  const url = "https://upload.twitter.com/1.1/media/upload.json";
  const mediaData = bytes.toString("base64");
  const body = new URLSearchParams({ media_data: mediaData, media_category: "tweet_image" });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader("POST", url, Object.fromEntries(body.entries())),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const result = await response.json();
  if (!response.ok || !result.media_id_string) throw new Error(result?.errors?.[0]?.message ?? "X media upload failed.");
  return result.media_id_string as string;
}

export async function publishReportToX({ caption, imageUrl }: { caption: string; imageUrl: string }) {
  const imageResponse = await fetch(imageUrl, { cache: "no-store" });
  if (!imageResponse.ok) throw new Error("Could not render the report image for X.");
  const mediaId = await uploadMedia(Buffer.from(await imageResponse.arrayBuffer()));
  const url = "https://api.x.com/2/tweets";
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: oauthHeader("POST", url), "Content-Type": "application/json" },
      body: JSON.stringify({ text: caption.slice(0, 280), media: { media_ids: [mediaId] } }),
    });
  } catch {
    throw new Error("X post outcome is unknown; reconcile the account before retrying.");
  }
  const result = await response.json();
  if (!response.ok || !result?.data?.id) throw new Error(result?.detail ?? result?.errors?.[0]?.message ?? "X post failed.");
  return result.data.id as string;
}
