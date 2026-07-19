export type TimezoneOption = {
  value: string;
  label: string;
  offsetMinutes: number;
};

const ALL_TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["Etc/UTC"];

// "longOffset" returns a stable "GMT+08:00" / "GMT-03:30" / "GMT" string on both
// Node and modern browsers, where "shortOffset" disagrees and causes hydration
// mismatches. Parse it once and derive everything else from the numeric value.
function offsetMinutes(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(new Date());
    const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const match = raw.match(/GMT([+-])(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    const sign = match[1] === "-" ? -1 : 1;
    return sign * (Number(match[2]) * 60 + Number(match[3]));
  } catch {
    return 0;
  }
}

export function formatUtcOffset(mins: number): string {
  if (mins === 0) return "UTC";
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${String(minutes).padStart(2, "0")}`;
}

export const TIMEZONE_GROUPS: Record<string, TimezoneOption[]> = (() => {
  const groups = ALL_TIMEZONES.reduce<Record<string, TimezoneOption[]>>((acc, tz) => {
    const region = tz.split("/")[0] || "Other";
    acc[region] = acc[region] ?? [];
    const mins = offsetMinutes(tz);
    acc[region].push({
      value: tz,
      label: `${tz.replace(/_/g, " ")} (${formatUtcOffset(mins)})`,
      offsetMinutes: mins,
    });
    return acc;
  }, {});

  for (const region of Object.keys(groups)) {
    groups[region].sort((a, b) =>
      a.offsetMinutes !== b.offsetMinutes
        ? a.offsetMinutes - b.offsetMinutes
        : a.value.localeCompare(b.value)
    );
  }
  return groups;
})();
