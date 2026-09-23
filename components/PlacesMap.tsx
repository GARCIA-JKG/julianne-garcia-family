"use client";

import { useEffect, useRef } from "react";
export type MapMemory = {
  id: string;
  title: string;
  dateLabel: string | null;
  place: string | null;
  latitude: number;
  longitude: number;
};

export function PlacesMap({ memories }: { memories: MapMemory[] }) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || memories.length === 0) return;

    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;

      map = L.map(mapRef.current, {
        scrollWheelZoom: false
      });

      L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
      ).addTo(map);

      const bounds: [number, number][] = [];

      for (const memory of memories) {
        const point: [number, number] = [
          memory.latitude,
          memory.longitude
        ];

        bounds.push(point);

        const popup = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = memory.title;

        const detail = document.createElement("p");
        detail.textContent = [
          memory.dateLabel,
          memory.place
        ]
          .filter(Boolean)
          .join(" · ");

        const link = document.createElement("a");
        link.href = "/memories/" + memory.id;
        link.textContent = "Open Memory →";

        popup.append(title, detail, link);

        L.circleMarker(point, {
          radius: 7,
          weight: 2,
          fillOpacity: 0.85
        })
          .addTo(map)
          .bindPopup(popup);
      }

      if (bounds.length === 1) {
        map.setView(bounds[0], 7);
      } else {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 7 });
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [memories]);

  if (!memories.length) {
    return (
      <div className="empty-keepsake">
        <span>OUR PLACES</span>
        <h2>Locations will appear here as Memories are mapped.</h2>
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="family-map"
      aria-label="Map of Garcia family Memories"
    />
  );
}
