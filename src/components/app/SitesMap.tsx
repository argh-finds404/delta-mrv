"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AtlasMap } from "@/src/components/atlas/AtlasMap";
import type { AtlasSite } from "@/src/components/atlas/types";
import { activityColor } from "@/src/lib/activity";
import { cn } from "@/src/lib/utils";

/**
 * The workspace's map: the caller's sites, coloured by activity. Clicking a site opens its
 * project page. A legend of the activities shown sits on the map.
 */
export function SitesMap({ sites, className, focusId }: { sites: AtlasSite[]; className?: string; focusId?: string }) {
  const router = useRouter();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const kinds = [...new Set(sites.map((s) => s.activity))].sort();
  const hoveredSite = sites.find((s) => s.id === hovered);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-field-hairline bg-field-stage", className)}>
      <AtlasMap
        sites={sites}
        selectedId={focusId ?? null}
        hoveredId={hovered}
        onHover={setHovered}
        onSelect={(id) => id && id !== focusId && router.push(`/projects/${id}`)}
        className="absolute inset-0"
      />
      {kinds.length > 0 && (
        <ul aria-label="Activities" className="hud absolute right-3 top-3 z-10 flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 text-[12px]">
          {kinds.map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: activityColor(k) }} />
              {k}
            </li>
          ))}
        </ul>
      )}
      {hoveredSite && !focusId && (
        <p className="hud pointer-events-none absolute bottom-3 right-3 z-10 px-3 py-2 text-[13px]">
          <span className="font-medium">{hoveredSite.title}</span>
          <span className="text-field-muted"> · open the project</span>
        </p>
      )}
    </div>
  );
}
