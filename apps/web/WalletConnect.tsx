"use client";

import { useEffect, useState } from "react";

const WALLET_STORAGE_KEY = "attention-bid-wallet";
const WALLET_EVENT = "attention-bid-wallet-change";

function publishWallet(wallet: string) {
  localStorage.setItem(WALLET_STORAGE_KEY, wallet);
  window.dispatchEvent(new CustomEvent(WALLET_EVENT, { detail: wallet }));
}

export function getStoredWallet() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(WALLET_STORAGE_KEY) ?? "";
}

export function subscribeToWallet(callback: (wallet: string) => void) {
  function handleWalletChange(event: Event) {
    callback((event as CustomEvent<string>).detail ?? getStoredWallet());
  }

  window.addEventListener(WALLET_EVENT, handleWalletChange);
  return () => window.removeEventListener(WALLET_EVENT, handleWalletChange);
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setWallet(getStoredWallet());

    async function autoConnectWallet() {
      const provider = (window as any).phantom?.solana;

      if (!provider?.isPhantom) {
        return;
      }

      try {
        const response = await provider.connect({
          onlyIfTrusted: true,
        });
        const publicKey = response.publicKey.toString();

        setWallet(publicKey);
        publishWallet(publicKey);
      } catch {
        // User has not approved this site yet.
      }
    }

    autoConnectWallet();
  }, []);

  async function connectWallet() {
    setMessage("");
    const provider = (window as any).phantom?.solana;

    if (!provider?.isPhantom) {
      setMessage("Phantom wallet not found. Install Phantom to bid with USDC.");
      return;
    }

    const response = await provider.connect();
    const publicKey = response.publicKey.toString();

    setWallet(publicKey);
    publishWallet(publicKey);
  }

  function disconnectDemoWallet() {
    localStorage.removeItem(WALLET_STORAGE_KEY);
    setWallet("");
    window.dispatchEvent(new CustomEvent(WALLET_EVENT, { detail: "" }));
  }

  return (
    <div className="wallet-panel">
      {wallet ? (
        <>
          <div>
            <span className="eyebrow">Connected wallet</span>
            <strong>
              {wallet.slice(0, 4)}...{wallet.slice(-4)}
            </strong>
          </div>
          <button className="ghost-button" onClick={disconnectDemoWallet}>
            Disconnect
          </button>
        </>
      ) : (
        <button className="wallet-button" onClick={connectWallet}>
          Connect Phantom
        </button>
      )}

      {message && <p className="form-message error">{message}</p>}
    </div>
  );
}
