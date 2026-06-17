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
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div style={{ marginBottom: "20px" }}>
      <h2>Next Attention Block</h2>

      <div
        style={{
          fontSize: "48px",
          fontWeight: "bold",
          color: "#00ff99",
        }}
      >
        {String(minutes).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}
      </div>
    </div>
  );
}
