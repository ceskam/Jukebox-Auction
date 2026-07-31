"use client";

import { useEffect, useState } from "react";

const WALLET_STORAGE_KEY = "attention-bid-wallet";
const WALLET_DISCONNECTED_KEY = "attention-bid-wallet-disconnected";
const WALLET_EVENT = "attention-bid-wallet-change";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: (options?: {
    onlyIfTrusted?: boolean;
  }) => Promise<{ publicKey: { toString: () => string } }>;
  disconnect?: () => Promise<void>;
  signMessage?: (
    message: Uint8Array,
    display?: "utf8"
  ) => Promise<{ signature: Uint8Array }>;
};

function publishWallet(wallet: string) {
  localStorage.setItem(WALLET_STORAGE_KEY, wallet);
  localStorage.removeItem(WALLET_DISCONNECTED_KEY);
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

function getProvider(): PhantomProvider | undefined {
  return (window as any).phantom?.solana;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

async function authenticateWallet(
  provider: PhantomProvider,
  wallet: string
) {
  if (!provider.signMessage) {
    throw new Error(
      "This Phantom version does not support wallet authentication signatures."
    );
  }

  const sessionResponse = await fetch("/api/auth/session", {
    cache: "no-store",
  });
  const session = await sessionResponse.json();

  if (session.authenticated && session.wallet === wallet) {
    return;
  }

  const challengeResponse = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet }),
  });
  const challenge = await challengeResponse.json();

  if (!challengeResponse.ok || !challenge.success) {
    throw new Error(challenge.message ?? "Could not start wallet authentication.");
  }

  const signed = await provider.signMessage(
    new TextEncoder().encode(challenge.message),
    "utf8"
  );
  const verifyResponse = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet,
      signature: bytesToBase64(signed.signature),
    }),
  });
  const verification = await verifyResponse.json();

  if (!verifyResponse.ok || !verification.success) {
    throw new Error(
      verification.message ?? "Could not verify wallet ownership."
    );
  }
}

export default function WalletConnect() {
  const [wallet, setWallet] = useState("");
  const [message, setMessage] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    async function restoreAuthenticatedWallet() {
      if (localStorage.getItem(WALLET_DISCONNECTED_KEY) === "true") {
        return;
      }

      const provider = getProvider();

      if (!provider?.isPhantom) {
        return;
      }

      try {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
        });
        const session = await sessionResponse.json();

        if (!session.authenticated || !session.wallet) {
          localStorage.removeItem(WALLET_STORAGE_KEY);
          return;
        }

        const response = await provider.connect({
          onlyIfTrusted: true,
        });
        const publicKey = response.publicKey.toString();

        if (publicKey !== session.wallet) {
          await fetch("/api/auth/session", { method: "DELETE" });
          localStorage.removeItem(WALLET_STORAGE_KEY);
          return;
        }

        setWallet(publicKey);
        publishWallet(publicKey);
      } catch {
        localStorage.removeItem(WALLET_STORAGE_KEY);
      }
    }

    void restoreAuthenticatedWallet();
  }, []);

  async function connectWallet() {
    setMessage("");
    const provider = getProvider();

    if (!provider?.isPhantom) {
      setMessage("Phantom wallet not found. Install Phantom to bid with USDC.");
      return;
    }

    setIsConnecting(true);

    try {
      const response = await provider.connect();
      const publicKey = response.publicKey.toString();

      setMessage("Approve the free authentication signature in Phantom.");
      await authenticateWallet(provider, publicKey);

      setWallet(publicKey);
      publishWallet(publicKey);
      setMessage("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not authenticate this wallet."
      );
    } finally {
      setIsConnecting(false);
    }
  }

  async function disconnectWallet() {
    const provider = getProvider();

    try {
      await provider?.disconnect?.();
    } catch {
      // Phantom may not expose disconnect in every environment.
    }

    localStorage.setItem(WALLET_DISCONNECTED_KEY, "true");
    localStorage.removeItem(WALLET_STORAGE_KEY);
    await fetch("/api/auth/session", { method: "DELETE" }).catch(
      () => undefined
    );
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
          <button className="ghost-button" onClick={disconnectWallet}>
            Disconnect
          </button>
        </>
      ) : (
        <button
          className="wallet-button"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? "Authenticating..." : "Connect Phantom"}
        </button>
      )}

      {message && <p className="form-message error">{message}</p>}
    </div>
  );
}
