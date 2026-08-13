"use client";

import { useEffect, useState } from "react";

type Greeting = "Hello" | "Good morning" | "Good afternoon" | "Good evening";

function greetingForHour(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

export function PublicPreviewGreeting({ name = "Lido" }: { name?: string }) {
  const [greeting, setGreeting] = useState<Greeting>("Hello");

  useEffect(() => {
    const updateGreeting = () => {
      setGreeting(greetingForHour(new Date().getHours()));
    };

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <h3
      aria-live="polite"
      style={{ fontFamily: "Georgia,serif", fontSize: 32, margin: "14px 0 0" }}
    >
      {greeting}, {name}.
    </h3>
  );
}
