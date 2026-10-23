type VerifiedBidResult = {
  success?: boolean;
  campaignConversion?: { event: "verified_user_bid"; value_usd: number };
};

export function trackVerifiedBid(result: VerifiedBidResult) {
  const conversion = result.campaignConversion;
  if (
    !result.success ||
    conversion?.event !== "verified_user_bid" ||
    !Number.isFinite(conversion.value_usd) ||
    conversion.value_usd <= 0 ||
    typeof window === "undefined"
  ) return;

  // Optional analytics must never interrupt payment receipt recovery or success.
  // No wallet address, payment signature, or authentication data is submitted.
  try {
    const sdk = (window as Window & {
      mintfunnel?: { track: (event: string, props: { value_usd: number }) => void };
    }).mintfunnel;
    if (process.env.NEXT_PUBLIC_MINTFUNNEL_TOKEN) {
      sdk?.track(conversion.event, { value_usd: conversion.value_usd });
    }
  } catch {
    // A blocked/unavailable analytics provider is not a payment failure.
  }

  // Bitmedia's documented client-side conversion queue. Keep each provider
  // isolated: a missing or throwing Mintfunnel SDK must not suppress Bitmedia.
  const conversionId = process.env.NEXT_PUBLIC_BITMEDIA_CONVERSION_ID;
  if (!conversionId || !/^[a-f0-9]{24}$/i.test(conversionId)) return;
  try {
    const target = window as Window & { BMDataLayer?: unknown[] };
    target.BMDataLayer = target.BMDataLayer || [];
    target.BMDataLayer.push({
      conversionID: conversionId,
      eventId: "verifiedbid",
      event: "conversion",
      eventValue: String(conversion.value_usd),
    });
  } catch {
    // Optional attribution never changes payment success or receipt recovery.
  }
}
