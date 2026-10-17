export function importProgressPercent(done: number, total: number): number {
  return total > 0 ? Math.floor(Math.min(100, Math.max(0, (done / total) * 100))) : 0;
}

export function ImportProgressRing({
  done,
  total,
  className = "size-4",
}: {
  done: number;
  total: number;
  className?: string;
}) {
  const percent = importProgressPercent(done, total);
  const circumference = 2 * Math.PI * 7;

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className}>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <circle
        cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        strokeLinecap="round"
        transform="rotate(-90 10 10)"
        className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-300"
      />
    </svg>
  );
}
