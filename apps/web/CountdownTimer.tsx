"use client";

import { useEffect, useState } from "react";

type Props = {
  endsAt: number;
};

export default function CountdownTimer({ endsAt }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.floor((endsAt - Date.now()) / 1000))
  );

  useEffect(() => {
    let didRefresh = false;

    const interval = setInterval(() => {
      const nextSecondsLeft = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setSecondsLeft(nextSecondsLeft);

      if (nextSecondsLeft === 0 && !didRefresh) {
        didRefresh = true;
        window.setTimeout(() => window.location.reload(), 900);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <section className="timer-panel" aria-label="Next auction countdown">
      <span className="eyebrow">Auction ends in</span>
      <strong className="timer-value">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </strong>
      <div className="timer-bar">
        <span style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / 900) * 100))}%` }} />
      </div>
      <p>{Math.ceil((secondsLeft / 900) * 100)}% of this block remaining</p>
    </section>
  );
}
