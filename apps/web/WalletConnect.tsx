"use client";

import { useState } from "react";

export default function WalletConnect() {
  const [wallet, setWallet] = useState("");

  async function connectWallet() {
    const provider = (window as any).phantom?.solana;

    if (!provider?.isPhantom) {
      alert("Phantom wallet not found. Please install Phantom.");
      return;
    }

    const response = await provider.connect();
    setWallet(response.publicKey.toString());
  }

  return (
    <div style={{ marginBottom: "20px" }}>
      {wallet ? (
        <p>
          Connected Wallet: {wallet.slice(0, 4)}...
          {wallet.slice(-4)}
        </p>
      ) : (
        <button onClick={connectWallet}>
          Connect Phantom Wallet
        </button>
      )}
    </div>
  );
}
