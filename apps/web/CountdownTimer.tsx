"use client";

import { useEffect, useState } from "react";

type Props = {
  endsAt: number;
  houseBidActive?: boolean;
};

type TimerPhase = "open" | "soon" | "urgent" | "final" | "closed";

function getTimerPhase(secondsLeft: number): TimerPhase {
  if (secondsLeft === 0) return "closed";
  if (secondsLeft <= 10) return "final";
  if (secondsLeft <= 60) return "urgent";
  if (secondsLeft <= 5 * 60) return "soon";
  return "open";
}

const TIMER_NOTICES: Record<
  TimerPhase,
  { label: string; message: string }
> = {
  open: {
    label: "Bidding is open",
    message: "Place a bid now for the next 15-minute attention block.",
  },
  soon: {
    label: "Ending soon",
    message: "Five minutes or less remain. Place your bid soon.",
  },
  urgent: {
    label: "Final minute",
    message: "Submit now so your USDC transfer has time to confirm.",
  },
  final: {
    label: "Closing now",
    message: "A bid sent this late may not confirm before the block closes.",
  },
  closed: {
    label: "Auction closed",
    message: "Loading the winner and opening the next block…",
  },
};

export default function CountdownTimer({
  endsAt,
  houseBidActive = false,
}: Props) {
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
  const percentRemaining = Math.max(
    0,
    Math.min(100, Math.ceil((secondsLeft / 900) * 100))
  );
  const phase = getTimerPhase(secondsLeft);
  const notice =
    houseBidActive && (phase === "open" || phase === "soon")
      ? {
          label: "House sponsored bid",
          message: "Operator funded. A verified user bid of 0.25 USDC or more takes priority.",
        }
      : TIMER_NOTICES[phase];

  return (
    <section
      className={`timer-panel timer-${phase}`}
      aria-label="Current auction countdown"
    >
      <div className="timer-heading">
        <span className="eyebrow">Bidding closes in</span>
        <span className="timer-status">
          <span aria-hidden="true" />
          {notice.label}
        </span>
      </div>
      <strong className="timer-value">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </strong>
      <div
        className="timer-bar"
        role="progressbar"
        aria-label="Time remaining"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentRemaining}
      >
        <span style={{ width: `${percentRemaining}%` }} />
      </div>
      <div className="timer-notice" role="status" aria-live="polite">
        <strong>{notice.label}</strong>
        <span>{notice.message}</span>
      </div>
      <p className="timer-remaining">
        {percentRemaining}% of this block remaining
      </p>
    </section>
  );
}
