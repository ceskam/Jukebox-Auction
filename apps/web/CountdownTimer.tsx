"use client";

import { useEffect, useState } from "react";

export default function CountdownTimer() {
  const [secondsLeft, setSecondsLeft] = useState(15 * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 15 * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
