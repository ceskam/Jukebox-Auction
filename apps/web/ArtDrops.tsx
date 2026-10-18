import type { PublicArtDrop } from "./lib/art-drops";
import { getSolscanTransactionUrl } from "./lib/solscan";

function shortWallet(wallet: string) {
  return wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "";
}

export default function ArtDrops({
  active,
  recent,
}: {
  active?: PublicArtDrop;
  recent: PublicArtDrop[];
}) {
  return (
    <section className="art-drops" id="art-drops" aria-labelledby="art-drops-title">
      <div className="art-drops-heading">
        <div>
          <span className="eyebrow">Direct viewer rewards</span>
          <h2 id="art-drops-title">AdBidCoin Art Drops</h2>
          <p>
            Limited, operator-funded USDC rewards. The first wallet-authenticated,
            human-verified claimant with the active code wins.
          </p>
        </div>
        <a className="ghost-button" href="/claim">
          Open claim desk
        </a>
      </div>

      {active ? (
        <div className="art-drop-live">
          <img
            src={`/api/art-drops/${encodeURIComponent(active.publicId)}/image`}
            alt={`Active AdBidCoin Art Drop worth ${active.rewardUsdc.toFixed(2)} USDC`}
            width="1200"
            height="630"
          />
          <div className="art-drop-live-actions">
            <div>
              <strong>{active.rewardUsdc.toFixed(2)} USDC is live</strong>
              <span>
                Expires {active.expiresAt ? new Date(active.expiresAt).toLocaleString() : "soon"}
              </span>
            </div>
            <a className="primary-link" href="/claim">
              Claim this drop
            </a>
          </div>
        </div>
      ) : (
        <div className="art-drop-waiting">
          <strong>No Art Drop is live right now.</strong>
          <span>New drops appear at randomized intervals. Check back soon.</span>
        </div>
      )}

      {recent.length > 0 && (
        <div className="art-drop-proof">
          <span className="eyebrow">Recent verified payouts</span>
          <ul>
            {recent.map((drop) => (
              <li key={drop.publicId}>
                <span>{shortWallet(drop.claimWallet)}</span>
                <strong>{drop.rewardUsdc.toFixed(2)} USDC</strong>
                {drop.payoutSignature && (
                  <a
                    href={getSolscanTransactionUrl(drop.payoutSignature)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Receipt
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="art-drop-disclosure">
        No private keys are published. Never enter a recovery phrase or private key
        to claim a reward. Eligibility and availability are subject to the{` `}
        <a href="/art-drop-rules">Art Drop rules</a>.
      </p>
    </section>
  );
}
