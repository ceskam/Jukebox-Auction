import { Connection, ParsedAccountData, PublicKey } from "@solana/web3.js";
import { calculateBidMultiplier } from "./bid-power-math";

export {
  calculateBidMultiplier,
  calculateEffectiveBidUsdc,
  MAX_BID_MULTIPLIER,
  TOKENS_FOR_MAX_POWER,
  TOKENS_PER_ADDITIONAL_POWER,
} from "./bid-power-math";

export const QUIET_MINT_ADDRESS =
  process.env.QUIET_MINT_ADDRESS ??
  "JCfSVdmBNKwMnMUMccfNbQQVVJKYsQNbXCqhdRuZpump";

export type BidPowerSnapshot = {
  quietBalance: number;
  bidMultiplier: number;
  snapshotSlot: number;
  mintAddress: string;
};

function round(value: number, decimalPlaces: number) {
  const scale = 10 ** decimalPlaces;
  return Math.round(value * scale) / scale;
}

function getRpcUrl() {
  return process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
}

function readUiBalance(data: ParsedAccountData) {
  const tokenAmount = data.parsed?.info?.tokenAmount as
    | { uiAmountString?: string; amount?: string; decimals?: number }
    | undefined;

  if (!tokenAmount) return 0;

  const uiAmount = Number(tokenAmount.uiAmountString);
  if (Number.isFinite(uiAmount)) return uiAmount;

  const rawAmount = Number(tokenAmount.amount);
  const decimals = Number(tokenAmount.decimals);
  if (!Number.isFinite(rawAmount) || !Number.isFinite(decimals)) return 0;

  return rawAmount / 10 ** decimals;
}

export async function getQuietBidPower(
  wallet: string
): Promise<BidPowerSnapshot> {
  const rpcUrl = getRpcUrl();

  if (!rpcUrl) {
    if (process.env.ENABLE_DEMO_PAYMENTS === "true") {
      return {
        quietBalance: 0,
        bidMultiplier: 1,
        snapshotSlot: 0,
        mintAddress: QUIET_MINT_ADDRESS,
      };
    }

    throw new Error("Solana RPC is required to verify QUIET bid power.");
  }

  const owner = new PublicKey(wallet);
  const mint = new PublicKey(QUIET_MINT_ADDRESS);
  const connection = new Connection(rpcUrl, "confirmed");
  const accounts = await connection.getParsedTokenAccountsByOwner(
    owner,
    { mint },
    "confirmed"
  );
  const quietBalance = round(
    accounts.value.reduce(
      (total, account) => total + readUiBalance(account.account.data),
      0
    ),
    9
  );

  return {
    quietBalance,
    bidMultiplier: calculateBidMultiplier(quietBalance),
    snapshotSlot: accounts.context.slot,
    mintAddress: mint.toBase58(),
  };
}
