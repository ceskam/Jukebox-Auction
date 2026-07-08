import { getAuctionById } from "./auction";
import { createSupabaseServerClient } from "./supabase/server";

export type AttentionContent = {
  auctionId: string;
  wallet: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  moderationStatus: "approved" | "hidden" | "rejected";
  moderationNote: string;
  reviewedAt: string | null;
  reviewedBy: string;
  createdAt: string;
  updatedAt: string | null;
};

type AttentionContentRow = {
  auction_id: string;
  wallet: string;
  title: string;
  description: string;
  url: string;
  image_url: string | null;
  moderation_status: "approved" | "hidden" | "rejected" | null;
  moderation_note: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string | null;
};

const ATTENTION_SELECT =
  "auction_id, wallet, title, description, url, image_url, moderation_status, moderation_note, reviewed_at, reviewed_by, created_at, updated_at";

function mapAttentionContent(row: AttentionContentRow): AttentionContent {
  return {
    auctionId: row.auction_id,
    wallet: row.wallet,
    title: row.title,
    description: row.description,
    url: row.url,
    imageUrl: row.image_url ?? "",
    moderationStatus: row.moderation_status ?? "approved",
    moderationNote: row.moderation_note ?? "",
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAttentionContent(auctionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attention_content")
    .select(ATTENTION_SELECT)
    .eq("auction_id", auctionId)
    .eq("moderation_status", "approved")
    .limit(1)
    .maybeSingle<AttentionContentRow>();

  if (error) {
    throw new Error(`Could not load attention content for ${auctionId}: ${error.message}`);
  }

  return data ? mapAttentionContent(data) : undefined;
}

export async function getRecentAttentionContent(limit = 25) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attention_content")
    .select(ATTENTION_SELECT)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AttentionContentRow[]>();

  if (error) {
    throw new Error(`Could not load attention content for admin review: ${error.message}`);
  }

  return (data ?? []).map(mapAttentionContent);
}

function normalizeUrl(url: string) {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return "";
    }
    return parsedUrl.toString();
  } catch {
    return `https://${url}`;
  }
}

function validateAttentionContent({
  title,
  description,
  url,
  imageUrl,
}: {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
}) {
  if (!title) {
    return "Add a title for your attention block.";
  }

  if (title.length > 80) {
    return "Keep the title under 80 characters.";
  }

  if (description.length > 600) {
    return "Keep the description under 600 characters.";
  }

  if (url && !normalizeUrl(url)) {
    return "Use a valid http or https link.";
  }

  if (imageUrl && !normalizeUrl(imageUrl)) {
    return "Use a valid http or https image URL.";
  }

  return "";
}

export async function saveAttentionContent({
  auctionId,
  wallet,
  title,
  description,
  url,
  imageUrl,
}: {
  auctionId: string;
  wallet: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
}) {
  const auction = await getAuctionById(auctionId);

  if (!wallet || wallet !== auction.winner) {
    return {
      success: false,
      message: "Only the winning wallet can edit this attention block.",
    };
  }

  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();
  const normalizedUrl = normalizeUrl(url.trim());
  const normalizedImageUrl = normalizeUrl(imageUrl.trim());
  const validationMessage = validateAttentionContent({
    title: trimmedTitle,
    description: trimmedDescription,
    url: url.trim(),
    imageUrl: imageUrl.trim(),
  });

  if (validationMessage) {
    return {
      success: false,
      message: validationMessage,
    };
  }

  const now = new Date().toISOString();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("attention_content").upsert(
    {
      auction_id: auction.id,
      wallet,
      title: trimmedTitle,
      description: trimmedDescription,
      url: normalizedUrl,
      image_url: normalizedImageUrl,
      moderation_status: "approved",
      moderation_note: "",
      reviewed_at: now,
      reviewed_by: "auto",
      created_at: now,
      updated_at: now,
    },
    {
      onConflict: "auction_id",
    }
  );

  if (error) {
    return {
      success: false,
      message: `Could not save attention block: ${error.message}`,
    };
  }

  return {
    success: true,
    content: await getAttentionContent(auction.id),
  };
}

export async function moderateAttentionContent({
  auctionId,
  status,
  note,
  reviewedBy,
}: {
  auctionId: string;
  status: "approved" | "hidden" | "rejected";
  note: string;
  reviewedBy: string;
}) {
  if (!auctionId) {
    return {
      success: false,
      message: "Choose an attention block to moderate.",
    };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("attention_content")
    .update({
      moderation_status: status,
      moderation_note: note.trim(),
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy || "admin",
    })
    .eq("auction_id", auctionId);

  if (error) {
    return {
      success: false,
      message: `Could not update attention block: ${error.message}`,
    };
  }

  return {
    success: true,
    message: `Attention block marked ${status}.`,
  };
}
