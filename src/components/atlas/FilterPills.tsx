"use client";

import * as React from "react";
import { Filter, X, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface FilterState {
  activityType: string;
  verificationStatus: string;
  organization: string;
}

export interface FilterPillsProps {
  /** Current filter values */
  filters: FilterState;
  /** Callback when any filter changes */
  onFilterChange: (filters: FilterState) => void;
  /** Available activity types extracted from loaded data */
  activityTypes?: string[];
  /** Available verification statuses */
  verificationStatuses?: string[];
  /** Available organizations extracted from loaded data */
  organizations?: string[];
  /** Total matching count vs total loaded count */
  matchCount?: number;
  totalCount?: number;
  /** Theme */
  theme?: "field" | "paper";
  /** Additional CSS class names */
  className?: string;
}

/**
 * FilterPills — Instant client-side filters for Impact Atlas.
 * Authority: docs/14-PAGE-SPEC.md §2 (Filters: Activity type, verification status, organisation).
 * Pure presentation: provides pills, dropdown-free toggles, and clear actions.
 */
export function FilterPills({
  filters,
  onFilterChange,
  activityTypes = [
    "All",
    "Mangrove Restoration",
    "Reforestation",
    "Agroforestry",
    "Wetland Conservation",
  ],
  verificationStatuses = ["All", "MATCH", "PENDING", "UNAVAILABLE"],
  organizations = [
    "All",
    "Sundarbans Restoration Trust",
    "Surma Ecological Initiative",
    "Coastal Resilience Fund",
    "Green Dhaka Coalition",
  ],
  matchCount,
  totalCount,
  theme = "paper",
  className,
}: FilterPillsProps) {
  const isPaper = theme === "paper";

  const hasActiveFilters =
    filters.activityType !== "All" ||
    filters.verificationStatus !== "All" ||
    filters.organization !== "All";

  const handleClear = () => {
    onFilterChange({
      activityType: "All",
      verificationStatus: "All",
      organization: "All",
    });
  };

  return (
    <div
      role="search"
      aria-label="Filter ecological projects"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border p-2 text-xs shadow-md backdrop-none",
        isPaper
          ? "border-paper-rule bg-paper-card text-paper-ink"
          : "border-field-hairline bg-field-canopy text-field-text",
        className
      )}
    >
      <div className="flex items-center gap-1.5 px-2 font-mono text-[11px] text-field-muted uppercase">
        <Filter className="size-3 text-signal" />
        <span className="hidden sm:inline">Filters:</span>
      </div>

      {/* 1. Activity Type Selector */}
      <div className="flex items-center gap-1">
        <label htmlFor="filter-activity" className="sr-only">
          Activity Type
        </label>
        <select
          id="filter-activity"
          value={filters.activityType}
          onChange={(e) =>
            onFilterChange({ ...filters, activityType: e.target.value })
          }
          className={cn(
            "rounded border px-2.5 py-1 text-xs font-sans transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal cursor-pointer",
            filters.activityType !== "All"
              ? isPaper
                ? "border-paper-seal bg-paper-seal/10 text-paper-ink font-medium"
                : "border-signal bg-signal/10 text-signal font-medium"
              : isPaper
              ? "border-paper-rule bg-paper text-paper-ink"
              : "border-field-hairline bg-field-raised text-field-text"
          )}
        >
          {activityTypes.map((type) => (
            <option key={type} value={type} className="bg-field-canopy text-field-text">
              {type === "All" ? "Activity: All" : type}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Verification Status Selector */}
      <div className="flex items-center gap-1">
        <label htmlFor="filter-status" className="sr-only">
          Verification Status
        </label>
        <select
          id="filter-status"
          value={filters.verificationStatus}
          onChange={(e) =>
            onFilterChange({ ...filters, verificationStatus: e.target.value })
          }
          className={cn(
            "rounded border px-2.5 py-1 text-xs font-sans transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal cursor-pointer",
            filters.verificationStatus !== "All"
              ? isPaper
                ? "border-paper-seal bg-paper-seal/10 text-paper-ink font-medium"
                : "border-signal bg-signal/10 text-signal font-medium"
              : isPaper
              ? "border-paper-rule bg-paper text-paper-ink"
              : "border-field-hairline bg-field-raised text-field-text"
          )}
        >
          {verificationStatuses.map((st) => (
            <option key={st} value={st} className="bg-field-canopy text-field-text">
              {st === "All" ? "Status: All" : `Status: ${st}`}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Organisation Selector */}
      <div className="flex items-center gap-1">
        <label htmlFor="filter-org" className="sr-only">
          Organisation
        </label>
        <select
          id="filter-org"
          value={filters.organization}
          onChange={(e) =>
            onFilterChange({ ...filters, organization: e.target.value })
          }
          className={cn(
            "rounded border px-2.5 py-1 text-xs font-sans transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal cursor-pointer max-w-[160px] truncate",
            filters.organization !== "All"
              ? isPaper
                ? "border-paper-seal bg-paper-seal/10 text-paper-ink font-medium"
                : "border-signal bg-signal/10 text-signal font-medium"
              : isPaper
              ? "border-paper-rule bg-paper text-paper-ink"
              : "border-field-hairline bg-field-raised text-field-text"
          )}
        >
          {organizations.map((org) => (
            <option key={org} value={org} className="bg-field-canopy text-field-text truncate">
              {org === "All" ? "Org: All" : org}
            </option>
          ))}
        </select>
      </div>

      {/* Clear Filters Button (When Active) */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            "flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-mono transition-colors",
            isPaper
              ? "border-paper-rule bg-paper hover:bg-paper-rule/40 text-paper-muted"
              : "border-field-hairline bg-field-raised hover:bg-field-hairline text-field-muted hover:text-field-text"
          )}
        >
          <X className="size-3" />
          <span>Clear</span>
        </button>
      )}

      {/* Matching Count Badge */}
      {typeof matchCount === "number" && (
        <div
          className={cn(
            "ml-auto hidden sm:flex items-center gap-1.5 px-2 font-mono tabular-nums text-[11px]",
            isPaper ? "text-paper-muted" : "text-field-muted"
          )}
        >
          <span>
            {matchCount} of {totalCount ?? matchCount} projects
          </span>
        </div>
      )}
    </div>
  );
}
