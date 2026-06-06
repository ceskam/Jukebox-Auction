"use client";

export default function BidButton() {
  async function placeTestBid() {
    await fetch("/api/bid", {
      method: "POST",
    });

    window.location.reload();
  }

  return <button onClick={placeTestBid}>Place Test Bid</button>;
}
