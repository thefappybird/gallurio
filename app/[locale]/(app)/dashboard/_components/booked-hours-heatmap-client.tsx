"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BookedHoursHeatmap as BookedHoursHeatmapComponent } from "./booked-hours-heatmap";

type Props = ComponentProps<typeof BookedHoursHeatmapComponent>;

// The measured grid deliberately renders only in the browser. Keeping it out
// of the RSC hydration tree prevents Turbopack hot updates from hydrating an
// older server-side grid shape against a newer responsive client shape.
const BookedHoursHeatmap = dynamic(
  () => import("./booked-hours-heatmap").then((module) => module.BookedHoursHeatmap),
  { ssr: false }
);

export function BookedHoursHeatmapClient(props: Props) {
  return <BookedHoursHeatmap {...props} />;
}
