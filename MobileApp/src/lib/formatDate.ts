export function formatClockTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Today 9:41 PM", "Yesterday 8:02 AM", or "Sep 11, 8:02 AM". */
export function formatEntryTimestamp(
  isoDate: string,
  now: Date = new Date(),
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const time = formatClockTime(isoDate);
  if (isSameLocalDay(date, now)) return `Today ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return `Yesterday ${time}`;

  const day = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}
