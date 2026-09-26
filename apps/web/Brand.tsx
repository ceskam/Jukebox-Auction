type BrandProps = {
  className?: string;
};

export default function Brand({ className = "" }: BrandProps) {
  return (
    <a
      className={`brand brand-lockup ${className}`.trim()}
      href="/"
      aria-label="AdBidCoin home"
    >
      <img
        className="brand-logo"
        src="/adbidcoin-logo.png"
        alt=""
        width="56"
        height="56"
      />
      <span className="brand-name">
        <span className="brand-accent">Ad</span>BidCoin
      </span>
    </a>
  );
}
