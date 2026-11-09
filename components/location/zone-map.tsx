"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

type Point = { lat: number; lon: number };

export type MapProps = {
  label: string;
  circles: (Point & { radiusM: number })[];
  reference?: Point & { label: string };
  zones?: (Point & { rank: number; name: string })[];
  // `lines` are shown in the marker's popup as plain text.
  establishments?: (Point & { same: boolean; lines: string[] })[];
};

// DENUE text is third-party data: popups and tooltips get text nodes, never
// HTML strings.
function textBox(lines: string[]) {
  const box = document.createElement("div");
  lines.forEach((line, i) => {
    const el = document.createElement(i === 0 ? "strong" : "div");
    el.textContent = line;
    box.append(el);
  });
  return box;
}

// Leaflet with OpenStreetMap tiles, loaded only in the browser
// (architecture.md §15). Markers use the ink tokens: filled for zones and
// same-industry establishments, outlined for the rest.
export function ZoneMap(props: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const data = JSON.stringify(props);

  useEffect(() => {
    const {
      circles,
      reference,
      zones = [],
      establishments = [],
    } = JSON.parse(data) as MapProps;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      const bounds = L.latLngBounds([]);
      for (const c of circles) {
        const circle = L.circle([c.lat, c.lon], {
          radius: c.radiusM,
          color: "#5c5c5c",
          weight: 2,
          dashArray: "6 6",
          fillOpacity: 0.04,
        }).addTo(map);
        bounds.extend(circle.getBounds());
      }
      for (const e of establishments) {
        L.circleMarker([e.lat, e.lon], {
          radius: e.same ? 6 : 5,
          color: e.same ? "#1a1a1a" : "#5c5c5c",
          weight: e.same ? 1 : 2,
          fillColor: e.same ? "#1a1a1a" : "#ffffff",
          fillOpacity: 1,
        })
          .bindPopup(textBox(e.lines))
          .addTo(map);
      }
      if (reference) {
        L.circleMarker([reference.lat, reference.lon], {
          radius: 8,
          color: "#1a1a1a",
          weight: 3,
          fillColor: "#ffffff",
          fillOpacity: 1,
        })
          .bindTooltip(textBox([reference.label]))
          .addTo(map);
      }
      for (const z of zones) {
        L.marker([z.lat, z.lon], {
          icon: L.divIcon({
            className: "",
            iconSize: [32, 32],
            html: `<span style="display:flex;width:32px;height:32px;align-items:center;justify-content:center;border-radius:50%;background:#1a1a1a;color:#fff;font:600 15px Inter,sans-serif;box-shadow:0 0 0 3px #fff">${Number(z.rank)}</span>`,
          }),
          keyboard: false,
        })
          .bindTooltip(textBox([z.name]))
          .addTo(map);
      }
      map.fitBounds(bounds, { padding: [16, 16] });
    });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [data]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={props.label}
      className="z-0 h-90 w-full overflow-hidden rounded-xl border border-divider bg-panel sm:h-105"
    />
  );
}
