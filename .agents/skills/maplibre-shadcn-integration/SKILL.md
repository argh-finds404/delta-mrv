---
name: maplibre-shadcn-integration
description: >-
  Frontend skill for building the Impact Atlas and cartographic interfaces in Delta-MRV using react-map-gl, MapLibre GL, and shadcn/ui. Use whenever creating or modifying map views, floating overlays, filter pills, telemetry drawers, or GeoJSON layers.
---

# Frontend Skill: MapLibre + Shadcn Integration

When designing the Impact Atlas, ensure `react-map-gl` (`maplibre-gl`) is the base layer.

## Rules & Constraints

1. **Base Map Canvas**: Use `react-map-gl` with `maplibre-gl` as the full-bleed base layer.
2. **Floating HUD Architecture**: All floating UI panels, filter pills, and telemetry drawers must use `shadcn/ui` components structured with Tailwind `absolute` positioning layered over the map canvas.
3. **GeoJSON Coordinate Ordering**: Always use `[longitude, latitude]` array ordering for MapLibre and GeoJSON compliance.

