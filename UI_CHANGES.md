# BrawlFast UI Changes - February 2024

## Changes Summary

This document tracks all UI/UX improvements made to BrawlFast, including layout changes, new columns, and visual enhancements.

### 1. **Layout Restructure** ✅

**Before**:
- Brawler Rankings and Best Teams were side-by-side in a 2-column grid layout

**After**:
- Brawler Rankings is full-width at the top
- Best Teams is full-width below (with 32px margin-top)
- Removed grid layout (`class="grid"`) from mapView container

**Benefit**:
- More horizontal space for the expanded brawler table
- Better readability on all screen sizes
- Clearer hierarchy (rankings first, then teams)

---

### 2. **New "BrawlFast Score" Column** ✅

**Location**: Brawler Rankings table, 4th column (after #, Tier, Brawler)

**Data Source**: `item.cps` from the API response (Competitive Performance Score)

**Display Format**:
- CPS value multiplied by 100 (converts 0.578 → 57.8)
- Formatted to 1 decimal place
- Shows "—" if CPS data not available
- **Styled**: Monospace font, bold weight, accent color (`var(--accent)`)

**Visual Example**:
```
#  | Tier | Brawler | BrawlFast Score | Adj WR | Raw WR | Samples | Impact
1  |  S   | Belle   |      57.8       | 55.2%  | 54.8%  |  1,234  | ████
2  |  A   | Brock   |      49.3       | 52.1%  | 51.9%  |    987  | ███
```

---

### 3. **Tier Display Enhancement** ✅

**Change**: Now uses server-provided tier (`item.tier`) if available, falls back to client-side calculation

**Before**: Client calculated tier based only on adjusted win rate
**After**: Uses sophisticated server-side CPS-based percentile tiers

**Tier Source**: From `assignTiers()` function in `lib/rankingEngine.js`

---

## Technical Details

### Modified Files

**File**: `public/index.html`

**Lines Changed**: 3 sections

#### Change 1: Layout (Lines 425-438)
```html
<!-- Before -->
<div id="mapView" class="grid hidden">
  <article class="panel">...</article>
  <article class="panel">...</article>
</div>

<!-- After -->
<div id="mapView" class="hidden">
  <article class="panel">...</article>
  <article class="panel" style="margin-top: 32px;">...</article>
</div>
```

#### Change 2: Table Headers (Line 627)
```html
<!-- Before -->
<thead><tr><th>#</th><th>Tier</th><th>Brawler</th><th>Adj WR</th>...

<!-- After -->
<thead><tr><th>#</th><th>Tier</th><th>Brawler</th><th>BrawlFast Score</th><th>Adj WR</th>...
```

#### Change 3: Table Data (Lines 629-633)
```javascript
// Before
const t = tier(adjusted);
return `<tr>...<td>${titleCase(item.name)}</td><td class="mono">${safePct(adjusted)}</td>...

// After
const t = item.tier || tier(adjusted);
const cpsScore = item.cps ? (item.cps * 100).toFixed(1) : '—';
return `<tr>...<td>${titleCase(item.name)}</td><td class="mono" style="font-weight: 600; color: var(--accent);">${cpsScore}</td><td class="mono">${safePct(adjusted)}</td>...
```

---

## Data Flow

### Server-Side (server.js)

The `/api/map/:id` endpoint returns brawlers with:
```json
{
  "brawlers": [
    {
      "name": "Belle",
      "tier": "S",
      "cps": 0.578,
      "winRate": 54.8,
      "adjustedWinRate": 55.2,
      "count": 1234
    }
  ]
}
```

### Client-Side (index.html)

JavaScript processes the data:
1. Extracts `item.cps` (e.g., 0.578)
2. Multiplies by 100 (57.8)
3. Formats to 1 decimal (57.8)
4. Renders in styled table cell

---

## Visual Styling

### BrawlFast Score Column Style
```css
font-family: var(--font-mono);  /* JetBrains Mono / Fira Code */
font-weight: 600;               /* Semi-bold */
color: var(--accent);           /* Indigo-500 (#6366f1) */
```

This makes the score stand out as the key metric while maintaining visual consistency.

---

## Responsive Behavior

**Mobile (< 768px)**:
- Full-width layout already optimal
- Table horizontally scrollable
- All columns visible via horizontal scroll

**Desktop (> 768px)**:
- Full-width panels use available space
- BrawlFast Score column fits comfortably
- No layout shifts

---

## Backward Compatibility

### Fallback Behavior

If the API doesn't provide `cps` or `tier` fields (older server versions):

1. **CPS Score**: Shows "—" (em dash)
2. **Tier**: Falls back to client-side calculation based on adjusted win rate

This ensures the UI works even with legacy API responses.

---

## User Experience Impact

### Before
- Users saw tier and win rates but didn't understand the sophisticated ranking
- Best Teams competed for attention with rankings

### After
- **BrawlFast Score** prominently displayed as the primary ranking metric
- Clear visual hierarchy: Rankings → Teams
- Users can see the algorithm's output (CPS) directly
- Score out of 100 is intuitive (higher = better)

---

## Testing Checklist

- [x] Server starts without errors
- [x] Health endpoint returns OK
- [x] Layout changed from grid to stacked
- [x] BrawlFast Score column added
- [x] Score displays correctly (CPS × 100)
- [x] Server-provided tiers used when available
- [x] Fallback to "—" when CPS not available
- [x] Styling applied (monospace, bold, accent color)

---

### 4. **Live Map Highlighting** ✅

**Location**: Search dropdown, active/live maps

**Visual Enhancements**:
- Yellow background highlight for maps that are currently active/live
- Yellow left border (3px) for visual distinction
- "LIVE" tag (previously "Today") in yellow
- Enhanced hover state for live maps

**CSS Added**:
```css
.drop-item.live-map {
  background: rgba(251, 191, 36, 0.08);
  border-left: 3px solid #fbbf24;
}

.drop-item.live-map:hover, .drop-item.live-map.active {
  background: rgba(251, 191, 36, 0.15);
}
```

**JavaScript Changes** (Line 526-528):
```javascript
const liveTag = item.activeToday ? '<span class="tag tag-today">LIVE</span>' : '';
const liveClass = item.activeToday ? ' live-map' : '';
html += `<button class="drop-item${liveClass}" ...`;
```

**Benefits**:
- Immediate visual feedback for currently active maps
- Helps users find live/rotating maps quickly
- Yellow color scheme consistent with "LIVE" tag
- Better UX for competitive players tracking active maps

**Example**:
- User types "gem" in search
- Active Gem Grab maps show with yellow background + "LIVE" tag
- Inactive maps show with normal styling

---

## Future Enhancements

Potential improvements:
1. **Tooltip**: Hover over BrawlFast Score to see component breakdown
2. **Sorting**: Click column headers to sort by different metrics
3. **Score Distribution Graph**: Visual histogram of scores
4. **Color Coding**: Gradient colors based on score ranges (0-30 red, 30-70 yellow, 70-100 green)

---

**Last Updated**: February 16, 2024
**Version**: 2.1
**Status**: ✅ Complete and Deployed
