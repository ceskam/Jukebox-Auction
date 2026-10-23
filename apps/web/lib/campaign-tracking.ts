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
    typeof window === "undefined" ||
    !process.env.NEXT_PUBLIC_MINTFUNNEL_TOKEN
  ) return;

  // Optional analytics must never interrupt payment receipt recovery or success.
  // No wallet address, payment signature, or authentication data is submitted.
  try {
    const sdk = (window as Window & {
      mintfunnel?: { track: (event: string, props: { value_usd: number }) => void };
    }).mintfunnel;
    sdk?.track(conversion.event, { value_usd: conversion.value_usd });
  } catch {
    // A blocked/unavailable analytics provider is not a payment failure.
  }
}
