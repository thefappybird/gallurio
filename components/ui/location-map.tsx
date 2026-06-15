"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// MVP launch market is the Philippines — default the empty map to Metro Manila.
const DEFAULT_CENTER: [number, number] = [14.5995, 120.9842];

// Self-contained SVG pin rendered as a Leaflet divIcon. Avoids Leaflet's
// default PNG marker assets (which break under the bundler) and lets the pin
// inherit the brand color in both themes.
function makePinIcon(): L.DivIcon {
  return L.divIcon({
    className: "gallurio-map-pin",
    html: `<svg width="28" height="40" viewBox="0 0 28 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 26 14 26s14-16.5 14-26C28 6.27 21.73 0 14 0z" fill="var(--brand)" stroke="var(--brand-foreground)" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5" fill="var(--brand-foreground)"/>
    </svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
  });
}

type Props = {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  disabled?: boolean;
  compact?: boolean;
  scrollWheelZoom?: boolean;
};

function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 14));
    }
  }, [lat, lng, map]);
  return null;
}

function ClickToPin({
  onPick,
  disabled,
}: {
  onPick: (lat: number, lng: number) => void;
  disabled?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (!disabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationMap({ lat, lng, onPick, disabled, compact, scrollWheelZoom = false }: Props) {
  const hasPin = lat != null && lng != null;
  const center: [number, number] = hasPin ? [lat, lng] : DEFAULT_CENTER;
  const pinIcon = useMemo(() => makePinIcon(), []);

  return (
    <MapContainer
      center={center}
      zoom={hasPin ? 14 : 11}
      scrollWheelZoom={scrollWheelZoom}
      className={compact ? "h-40 w-full sm:h-44" : "h-56 w-full sm:h-64"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={lat} lng={lng} />
      <ClickToPin onPick={onPick} disabled={disabled} />
      {hasPin ? (
        <Marker
          position={[lat, lng]}
          icon={pinIcon}
          draggable={!disabled}
          eventHandlers={{
            dragend(e) {
              const p = (e.target as L.Marker).getLatLng();
              onPick(p.lat, p.lng);
            },
          }}
        />
      ) : null}
    </MapContainer>
  );
}
