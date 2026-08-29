const X_URL = "https://x.com/attentionbid";
const TELEGRAM_URL = "https://t.me/+dVMl7qg8gJJlY2E0";

export default function CommunityCard() {
  return (
    <section className="community-card" id="community">
      <span className="eyebrow">Join the community</span>
      <h2>Follow every winning block.</h2>
      <p>
        Get launch updates, auction reminders, and beta announcements from
        Attention Bid.
      </p>
      <div className="community-links">
        <a href={X_URL} target="_blank" rel="noreferrer">
          <span className="community-link-mark" aria-hidden="true">
            X
          </span>
          <span>
            <small>Follow us on</small>
            X / @attentionbid
          </span>
          <span aria-hidden="true">↗</span>
        </a>
        <a href={TELEGRAM_URL} target="_blank" rel="noreferrer">
          <span className="community-link-mark telegram-mark" aria-hidden="true">
            TG
          </span>
          <span>
            <small>Join the group</small>
            Attention Bid Telegram
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </section>
  );
}
