export const DAYPART_VALUES = ["morning", "afternoon", "evening"] as const;

export type Daypart = (typeof DAYPART_VALUES)[number];

export const DAYPART_WALLPAPER_SCHEDULE = [
  {
    value: "morning",
    label: "Morning coast",
    hours: "00:00–11:59",
    description: "Soft dawn light for Good morning.",
  },
  {
    value: "afternoon",
    label: "Afternoon coast",
    hours: "12:00–17:59",
    description: "Clear daylight for Good afternoon.",
  },
  {
    value: "evening",
    label: "Evening coast",
    hours: "18:00–23:59",
    description: "Calm blue hour for Good evening.",
  },
] as const satisfies ReadonlyArray<{
  value: Daypart;
  label: string;
  hours: string;
  description: string;
}>;

export function daypartForHour(hour: number): Daypart {
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function daypartForDate(date = new Date()): Daypart {
  return daypartForHour(date.getHours());
}

export function greetingForDaypart(daypart: Daypart) {
  if (daypart === "morning") return "Good morning";
  if (daypart === "afternoon") return "Good afternoon";
  return "Good evening";
}

export function millisecondsUntilNextDaypart(date = new Date()) {
  const next = new Date(date);
  const hour = date.getHours();

  if (hour < 12) {
    next.setHours(12, 0, 0, 0);
  } else if (hour < 18) {
    next.setHours(18, 0, 0, 0);
  } else {
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }

  return Math.max(1_000, next.getTime() - date.getTime() + 250);
}
