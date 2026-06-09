"use client";

import { useState } from "react";

export default function BidButton() {
  const [amount, setAmount] = useState("");

  async function placeBid() {
    await fetch("/api/bid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(amount),
        wallet: "demo-wallet",
      }),
    });

    window.location.reload();
  }

  return (
    <div>
      <input
        type="number"
        placeholder="Enter bid amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <button onClick={placeBid}>
        Place Bid
      </button>
    </div>
  );
}
