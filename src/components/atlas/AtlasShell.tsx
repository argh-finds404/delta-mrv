"use client";

import * as React from "react";
import Link from "next/link";
import {
  Compass,
  Layers,
  MapPin,
  Maximize2,
  Shield,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { ProjectDrawer } from "./ProjectDrawer";
import { FilterPills, type FilterState } from "./FilterPills";
import { EmptyState } from "@/src/components/empty-state/empty-state";
import { type AtlasProject, sampleAtlasProjects } from "./fixtures";
import { cn } from "@/src/lib/utils";

export interface AtlasShellProps {
  /** Initial project list (defaults to sampleAtlasProjects fixture) */
  projects?: AtlasProject[];
  /** Theme (default: paper for public atlas per docs/14 §2) */
  theme?: "field" | "paper";
  /** Initial selected project slug */
  initialSelectedSlug?: string;
  /** Additional CSS class names */
  className?: string;
}

/**
 * AtlasShell — Full-bleed cartographic layout with overlaid controls.
 * Authority: docs/14-PAGE-SPEC.md §2 (Impact Atlas) & docs/15-UI-STATES.md §2 (Empty states).
 * Structure: Controls top-left, filter pills top-center, slide-over drawer right, map canvas placeholder.
 * Client-side instant filtering with Empty State E1 fallback.
 */
export function AtlasShell({
  projects = sampleAtlasProjects,
  theme = "paper",
  initialSelectedSlug,
  className,
}: AtlasShellProps) {
  const isPaper = theme === "paper";

  // Filter state
  const [filters, setFilters] = React.useState<FilterState>({
    activityType: "All",
    verificationStatus: "All",
    organization: "All",
  });

  // Selected project state
  const [selectedProject, setSelectedProject] = React.useState<AtlasProject | null>(() => {
    if (initialSelectedSlug) {
      return projects.find((p) => p.slug === initialSelectedSlug) ?? null;
    }
    return null;
  });

  const [isDrawerOpen, setIsDrawerOpen] = React.useState<boolean>(Boolean(selectedProject));

  // Client-side instant filtering over loaded data (docs/14-PAGE-SPEC.md §2)
  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) => {
      if (
        filters.activityType !== "All" &&
        project.activityType !== filters.activityType
      ) {
        return false;
      }
      if (
        filters.verificationStatus !== "All" &&
        project.verificationStatus !== filters.verificationStatus
      ) {
        return false;
      }
      if (
        filters.organization !== "All" &&
        project.ownerOrg !== filters.organization
      ) {
        return false;
      }
      return true;
    });
  }, [projects, filters]);

  const handleSelectProject = (project: AtlasProject) => {
    setSelectedProject(project);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleResetFilters = () => {
    setFilters({
      activityType: "All",
      verificationStatus: "All",
      organization: "All",
    });
  };

  return (
    <div
      data-theme={theme}
      className={cn(
        "relative flex h-screen w-full flex-col overflow-hidden select-none",
        isPaper ? "bg-paper text-paper-ink" : "bg-field-abyss text-field-text",
        className
      )}
    >
      {/* Top Overlay Bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center justify-between gap-3 p-4 md:flex-row md:items-start">
        {/* Top-Left Controls Overlaid */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs shadow-md",
              isPaper
                ? "border-paper-rule bg-paper-card text-paper-ink"
                : "border-field-hairline bg-field-canopy text-field-text"
            )}
          >
            <div className="flex size-6 items-center justify-center rounded-xs bg-field-raised border border-field-hairline">
              <span className="font-serif font-bold text-signal text-xs">Δ</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold tracking-tight text-xs">
                  Impact Atlas
                </span>
                <span className="font-mono text-[10px] text-signal rounded px-1 border border-field-hairline bg-field-abyss">
                  SRID 4326
                </span>
              </div>
              <span
                className={cn(
                  "font-mono text-[10px] block",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                Open Vector Basemap
              </span>
            </div>
          </div>

          <Link
            href="/demo"
            className={cn(
              "hidden sm:inline-flex items-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-mono shadow-md transition-colors",
              isPaper
                ? "border-paper-rule bg-paper-card text-paper-muted hover:text-paper-ink"
                : "border-field-hairline bg-field-canopy text-field-muted hover:text-field-text"
            )}
          >
            <Shield className="size-3.5 text-signal" />
            <span>Auditor view</span>
          </Link>
        </div>

        {/* Top-Center Filter Pills Overlaid */}
        <div className="pointer-events-auto w-full max-w-2xl md:w-auto">
          <FilterPills
            filters={filters}
            onFilterChange={setFilters}
            matchCount={filteredProjects.length}
            totalCount={projects.length}
            theme={theme}
          />
        </div>

        {/* Top-Right Quick Legend */}
        <div className="pointer-events-auto hidden lg:flex items-center gap-2">
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-mono shadow-md flex items-center gap-3",
              isPaper
                ? "border-paper-rule bg-paper-card text-paper-muted"
                : "border-field-hairline bg-field-canopy text-field-muted"
            )}
          >
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-verified" />
              <span>Anchored</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-review" />
              <span>In Review</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-fraud" />
              <span>Flagged</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Map Canvas Placeholder (docs/14-PAGE-SPEC.md §2) */}
      <main className="relative flex-1 w-full h-full">
        {/* Placeholder Cartographic Canvas Background */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center p-6 text-center",
            isPaper ? "bg-[#EDE6D6]" : "bg-[#0A1110]"
          )}
        >
          {/* Subtle grid lines mimicking cartographic graticule */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
              backgroundSize: "32px 32px",
            }}
          />

          {/* If filters produce 0 projects, render Empty State E1 */}
          {filteredProjects.length === 0 ? (
            <div className="relative z-20 max-w-md">
              <EmptyState
                title="No projects match these filters"
                reason={`${projects.length} projects exist in the registry. None match the active filter criteria.`}
                unfilteredCount={projects.length}
                action={{
                  label: "Reset all filters",
                  onClick: handleResetFilters,
                }}
                theme={theme}
              />
            </div>
          ) : (
            /* Interactive Project Centroids Canvas Preview */
            <div className="relative z-10 space-y-4 max-w-xl">
              <div
                className={cn(
                  "rounded-lg border p-5 text-left shadow-lg space-y-3",
                  isPaper
                    ? "border-paper-rule bg-paper-card text-paper-ink"
                    : "border-field-hairline bg-field-canopy text-field-text"
                )}
              >
                <div className="flex items-center justify-between border-b pb-2 border-inherit">
                  <span className="font-mono text-xs uppercase text-signal flex items-center gap-1.5">
                    <Compass className="size-3.5" />
                    <span>Cartographic Canvas (MapLibre Stub)</span>
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      isPaper ? "text-paper-muted" : "text-field-muted"
                    )}
                  >
                    Click any project polygon to inspect:
                  </span>
                </div>

                {/* Project interactive markers list */}
                <div className="space-y-2">
                  {filteredProjects.map((proj) => {
                    const isSelected = selectedProject?.id === proj.id && isDrawerOpen;
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => handleSelectProject(proj)}
                        className={cn(
                          "w-full text-left rounded-md border p-2.5 transition-colors flex items-center justify-between gap-3 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal cursor-pointer",
                          isSelected
                            ? isPaper
                              ? "border-paper-seal bg-paper text-paper-ink font-medium"
                              : "border-signal bg-field-raised text-field-text font-medium"
                            : isPaper
                            ? "border-paper-rule hover:bg-paper text-paper-ink"
                            : "border-field-hairline hover:bg-field-raised/60 text-field-text"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "size-2 rounded-full shrink-0",
                                proj.verificationStatus === "MATCH"
                                  ? "bg-verified"
                                  : proj.verificationStatus === "PENDING"
                                  ? "bg-review"
                                  : "bg-field-inert"
                              )}
                            />
                            <span className="text-xs truncate font-medium">
                              {proj.title}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "text-[11px] truncate pl-4",
                              isPaper ? "text-paper-muted" : "text-field-muted"
                            )}
                          >
                            {proj.ownerOrg} · {proj.location.region}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={cn(
                              "font-mono text-[11px] tabular-nums hidden sm:inline",
                              isPaper ? "text-paper-muted" : "text-field-muted"
                            )}
                          >
                            [{proj.location.coordinatesFuzzed[0].toFixed(2)},{" "}
                            {proj.location.coordinatesFuzzed[1].toFixed(2)}]
                          </span>
                          <span className="text-xs text-signal group-hover:translate-x-0.5 transition-transform">
                            →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div
                className={cn(
                  "font-mono text-[11px] text-center",
                  isPaper ? "text-paper-muted" : "text-field-muted"
                )}
              >
                <span>Showing {filteredProjects.length} fuzzed project centroids · </span>
                <span>MapLibre GL JS v5 client canvas will render over PostGIS geometry</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom-Left Map Navigation Controls */}
        <div className="pointer-events-auto absolute bottom-4 left-4 z-20 flex items-center gap-1.5">
          <div
            className={cn(
              "flex items-center rounded-lg border p-1 shadow-md",
              isPaper
                ? "border-paper-rule bg-paper-card text-paper-ink"
                : "border-field-hairline bg-field-canopy text-field-text"
            )}
          >
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset view"
              className={cn(
                "p-1.5 rounded transition-colors",
                isPaper ? "hover:bg-paper" : "hover:bg-field-raised"
              )}
            >
              <RotateCcw className="size-3.5" />
            </button>
            <div className="h-4 w-px bg-inherit mx-1" />
            <button
              type="button"
              title="Toggle full screen"
              className={cn(
                "p-1.5 rounded transition-colors",
                isPaper ? "hover:bg-paper" : "hover:bg-field-raised"
              )}
            >
              <Maximize2 className="size-3.5" />
            </button>
          </div>
        </div>
      </main>

      {/* Slide-over Desktop / Bottom-Sheet Mobile Project Drawer */}
      <ProjectDrawer
        project={selectedProject}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        theme={theme}
      />
    </div>
  );
}
