"use client";

import { useState } from "react";

type Props = {
  auctionId: string;
  wallet: string;
  winner: string | null;
};

export default function AttentionEditor({ auctionId, wallet, winner }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const isWinner = winner && wallet === winner;

  if (!isWinner) {
    return (
      <div
        style={{
          border: "2px solid #00ff99",
          padding: "20px",
          marginTop: "30px",
          borderRadius: "12px",
        }}
      >
        <h2>Create Attention Block</h2>
        <p>You must win the current auction to control this attention block.</p>
      </div>
    );
  }

  async function saveAttention() {
    await fetch("/api/attention", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auctionId,
        wallet,
        title,
        description,
        url,
      }),
    });

    alert("Attention Block Saved");
    window.location.reload();
  }

  return (
    <div
      style={{
        border: "2px solid #00ff99",
        padding: "20px",
        marginTop: "30px",
        borderRadius: "12px",
      }}
    >
      <h2>Create Attention Block</h2>

      <input
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />

      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          width: "100%",
          height: "100px",
          padding: "10px",
          marginBottom: "10px",
        }}
      />

      <input
        placeholder="URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: "100%", padding: "10px", marginBottom: "10px" }}
      />

      <button
        onClick={saveAttention}
        style={{ padding: "12px 24px", fontSize: "16px", cursor: "pointer" }}
      >
        Save Attention Block
      </button>
    </div>
  );
}
