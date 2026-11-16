import { createSupabaseServerClient } from "./supabase/server";

export type AuthenticatedUser = {
  id: string;
  email: string;
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | undefined> {
  const token = bearerToken(request);
  if (!token) return undefined;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return undefined;
  return { id: data.user.id, email: data.user.email ?? "" };
}

export function creditBidderIdentity(userId: string) {
  return `credit:${userId}`;
}
