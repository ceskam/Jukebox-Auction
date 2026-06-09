"use client";

import { useState } from "react";

export default function BidButton() {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  async function placeBid() {
    setMessage("");

    const res = await fetch("/api/bid", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Number(amount),
        wallet: "demo-wallet",
      }),
    });

    const result = await res.json();

    if (!result.success) {
      setMessage(result.message);
      return;
    }

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

      <button onClick={placeBid}>Place Bid</button>

      {message && (
        <p style={{ color: "red" }}>
          {message}
        </p>
      )}
    </div>
  );
}
