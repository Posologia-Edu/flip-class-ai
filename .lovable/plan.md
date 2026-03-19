

## Problem Diagnosis

The "Tempo Médio por Material" chart shows identical time for all materials because:

1. **`page_active` logs almost never include a `material_id`** — the IntersectionObserver-based detection isn't working reliably (database confirms nearly all `page_active` entries have `material_id = null`)
2. The current fallback logic distributes unattributed time equally among all viewed materials, making every material appear identical
3. `material_view` logs (marking as "seen") only record 1 second each — not useful for time tracking

## Plan

### 1. Fix per-material time tracking in StudentView

Replace the unreliable IntersectionObserver approach with explicit click/expand-based tracking:

- When a student **clicks on / expands a material card**, record `activeMaterialId` immediately (no intersection threshold needed)
- Every 30-second `page_active` tick on the materials tab sends the current `activeMaterialId` — this ensures time is attributed to the specific material the student is interacting with
- Add a `material_open` event when a student clicks to expand/view a material, with `duration_seconds = 0` as a discrete access event

**File:** `src/pages/StudentView.tsx`

### 2. Add a separate "Acessos por Material" (Views per Material) chart

Add a new bar chart to AnalyticsReport showing the **number of unique sessions** that accessed each material — this gives a clear picture of which materials are most popular, independent of time.

**File:** `src/components/AnalyticsReport.tsx`

### 3. Fix the time calculation to stop equal distribution

Update `timePerMaterial` logic:
- **Remove the equal-distribution fallback** for unattributed `page_active` time — this is what causes identical bars
- Only count time from `page_active` logs that have an explicit `material_id`
- Keep `material_view` and `material_access` logs for the access count chart

**File:** `src/components/AnalyticsReport.tsx`

### 4. Add "Marcados como visto" metric

Show how many students marked each material as "viewed" (from `material_view` logs) as a secondary metric in the chart or as a small badge, helping differentiate engagement levels.

### Summary of changes

| File | Change |
|------|--------|
| `src/pages/StudentView.tsx` | Track active material on click/expand instead of IntersectionObserver; always send `material_id` in `page_active` logs |
| `src/components/AnalyticsReport.tsx` | Remove equal-distribution fallback; add "Acessos por Material" chart; show real per-material time only from attributed logs |

