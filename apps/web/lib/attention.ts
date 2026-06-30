import { getAuctionById } from "./auction";
import { createSupabaseServerClient } from "./supabase/server";

export type AttentionContent = {
  auctionId: string;
  wallet: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
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
  created_at: string;
  updated_at: string | null;
};

function mapAttentionContent(row: AttentionContentRow): AttentionContent {
  return {
    auctionId: row.auction_id,
    wallet: row.wallet,
    title: row.title,
    description: row.description,
    url: row.url,
    imageUrl: row.image_url ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAttentionContent(auctionId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attention_content")
    .select("auction_id, wallet, title, description, url, image_url, created_at, updated_at")
    .eq("auction_id", auctionId)
    .limit(1)
    .maybeSingle<AttentionContentRow>();

  if (error) {
    throw new Error(`Could not load attention content for ${auctionId}: ${error.message}`);
  }

  return data ? mapAttentionContent(data) : undefined;
}

function normalizeUrl(url: string) {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.toString();
  } catch {
    return `https://${url}`;
  }
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

  if (!trimmedTitle) {
    return {
      success: false,
      message: "Add a title for your attention block.",
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
