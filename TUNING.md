# BrawlFast Ranking Algorithm Tuning Guide

## Quick Start

This guide helps you customize the ranking algorithm for different use cases, meta conditions, and competitive insights.

**Configuration File**: `/config/ranking.config.js`

**After changes**: Restart the server for changes to take effect.

---

## Common Tuning Scenarios

### Scenario 1: Major Balance Patch Just Dropped

**Goal**: Emphasize recent games to adapt quickly to balance changes.

**Changes**:
```javascript
// In config/ranking.config.js
timeWeighting: {
  halfLifeDays: 7  // Change from 14 to 7
}
```

**Effect**: Games from 1 week ago now have 50% weight (vs. 14 days). The algorithm adapts to new balance ~2x faster.

**When to use**: Within 2 weeks of major balance patches, new brawler releases, or game mode changes.

**Rollback**: Return to 14 after meta stabilizes (~3-4 weeks).

---

### Scenario 2: Emphasize Solo Skill in All Modes

**Goal**: Reduce team synergy importance, increase individual performance.

**Changes**:
```javascript
// Increase performance weight across all modes
mapWeights: {
  [MapType.GEM_GRAB]: {
    performance: 0.55,  // Up from 0.40
    synergy: 0.20,      // Down from 0.35
    popularity: 0.15,
    counter: 0.10
  },
  // Repeat for other team modes...
}
```

**Effect**: Brawlers with high individual win rates rank higher, even if they have poor team synergy.

**When to use**: Solo queue environments, casual play, or when team coordination is unreliable.

---

### Scenario 3: Competitive 3v3 Team Play

**Goal**: Maximize team synergy importance for organized teams.

**Changes**:
```javascript
mapWeights: {
  [MapType.GEM_GRAB]: {
    performance: 0.30,  // Down from 0.40
    synergy: 0.45,      // Up from 0.35
    popularity: 0.15,
    counter: 0.10
  },
  // Similar for Brawl Ball, Bounty, etc.
}
```

**Effect**: Brawlers that excel in coordinated team compositions rank higher, even if individual win rates are moderate.

**When to use**: Scrims, tournaments, organized team ladders.

---

### Scenario 4: Counter-Pick Focus (Draft Mode)

**Goal**: Emphasize matchup advantages for strategic drafting.

**Changes**:
```javascript
mapWeights: {
  [MapType.GEM_GRAB]: {
    performance: 0.35,
    synergy: 0.25,
    popularity: 0.10,
    counter: 0.30       // Up from 0.10
  }
}

counterMetaConfig: {
  minMatchupSampleCount: 20,  // Lower from 30 for more matchup data
  defaultScore: 0.5
}
```

**Effect**: Brawlers strong against current meta picks rank significantly higher.

**When to use**: Draft modes, when opponents' picks are known, or when meta is dominated by specific brawlers.

---

### Scenario 5: Conservative Confidence (High Stakes)

**Goal**: Only trust brawlers with lots of data, heavily penalize uncertainty.

**Changes**:
```javascript
bayesianPriors: {
  wins: 100,   // Up from 50
  losses: 100  // Up from 50
}
```

**Effect**: Requires ~2x more games to achieve same confidence level. Low-sample brawlers rank much lower.

**When to use**: Tournament finals, championship series, or when avoiding risk is critical.

**Warning**: New/niche brawlers may be severely underrated.

---

### Scenario 6: Discover Hidden Gems

**Goal**: Surface underrated brawlers with low use but high win rates.

**Changes**:
```javascript
useRateScores: {
  metaStrength: { base: 0.75, bonus: 0.2 },  // Slightly lower
  sleeperPick: { base: 0.85, bonus: 0.15 },  // Higher base for sleepers
  trapPick: 0.2,
  neutral: { base: 0.5, adjustment: 0.1 }
}

mapWeights: {
  // Increase popularity weight
  [MapType.GEM_GRAB]: {
    performance: 0.35,
    synergy: 0.30,
    popularity: 0.25,  // Up from 0.15
    counter: 0.10
  }
}
```

**Effect**: Sleeper picks (low use, high win) receive bonus scoring and rank higher in final tiers.

**When to use**: Looking for off-meta picks, surprise strategies, or when popular picks are being banned/countered.

---

## Configuration Reference

### Bayesian Priors

```javascript
bayesianPriors: {
  wins: 50,     // Default: 50
  losses: 50    // Default: 50
}
```

**What it does**: Sets the "assumed" performance before seeing actual data.

| Setting | Effect | Use Case |
|---------|--------|----------|
| Low (25/25) | Trust data faster, less penalty for small samples | Casual play, rapid meta changes |
| Default (50/50) | Balanced approach | General use |
| High (100/100) | Very conservative, requires lots of data | Competitive, high-stakes |
| Asymmetric (60/40) | Assumes brawlers are slightly above/below 50% | Meta-specific insights |

**Keep in mind**: Always keep `wins` and `losses` equal for a neutral 50% assumption unless you have strong meta-specific reasons.

---

### Time Weighting

```javascript
timeWeighting: {
  halfLifeDays: 14  // Default: 14
}
```

**What it does**: Controls how quickly old game data "decays" in importance.

| Half-Life | Game from 2 weeks ago | Use Case |
|-----------|----------------------|----------|
| 7 days | 25% weight | Post-patch rapid adaptation |
| 14 days (default) | 50% weight | Normal meta evolution |
| 21 days | 63% weight | Stable meta, long-term trends |
| 30 days | 71% weight | Very stable meta or historical analysis |

**Formula**: `weight = e^(-daysAgo / halfLife)`

---

### Map Weights

```javascript
mapWeights: {
  [MapType.GEM_GRAB]: {
    performance: 0.4,   // Individual win rate
    synergy: 0.35,      // Team composition strength
    popularity: 0.15,   // Meta relevance
    counter: 0.1        // Anti-meta value
  }
}
```

**What it does**: Determines what factors matter most for each game mode.

**Constraints**:
- All 4 weights must sum to **1.0** for each mode
- All weights must be between **0.0 and 1.0**

**Recommendations by Mode**:

| Mode | Performance | Synergy | Popularity | Counter | Rationale |
|------|------------|---------|-----------|---------|-----------|
| Showdown | 0.70-0.80 | 0.05-0.10 | 0.10-0.15 | 0.05-0.10 | Solo mode: individual skill is everything |
| Gem Grab | 0.35-0.45 | 0.30-0.40 | 0.10-0.20 | 0.10-0.15 | Team coordination critical, gem carrier + support |
| Hot Zone | 0.35-0.45 | 0.30-0.40 | 0.10-0.20 | 0.10-0.15 | Similar to Gem Grab |
| Heist | 0.50-0.65 | 0.10-0.20 | 0.10-0.20 | 0.10-0.20 | Specialists dominate, some synergy with safe defenders |
| Brawl Ball | 0.45-0.55 | 0.15-0.25 | 0.10-0.20 | 0.15-0.20 | Balanced, counter-picks important (long-range vs short) |
| Bounty | 0.45-0.55 | 0.15-0.25 | 0.10-0.20 | 0.15-0.20 | Individual elims + map control |
| Knockout | 0.45-0.55 | 0.15-0.25 | 0.10-0.20 | 0.15-0.20 | Similar to Bounty |

---

### Use Rate Intelligence

```javascript
useRateThresholds: {
  metaStrength: 0.5,
  sleeperPick: { winRateMin: 0.5, useRateMax: -0.5 },
  trapPick: { useRateMin: 0.5, winRateMax: -0.5 }
}

useRateScores: {
  metaStrength: { base: 0.8, bonus: 0.2 },
  sleeperPick: { base: 0.7, bonus: 0.3 },
  trapPick: 0.2,
  neutral: { base: 0.5, adjustment: 0.1 }
}
```

**What it does**: Classifies brawlers by use rate vs. win rate patterns.

**Thresholds** (Z-score cutoffs):
- **Tighten** (increase): Stricter classification, fewer outliers flagged
- **Loosen** (decrease): More liberal, more brawlers classified as meta/sleeper/trap

**Scores** (final contribution):
- **Meta strength base**: How much to reward popular + strong brawlers
- **Sleeper base**: How much to reward hidden gems
- **Trap penalty**: How much to penalize noob traps (always keep low)

---

### Synergy Configuration

```javascript
synergyConfig: {
  minTeamSampleCount: 50,
  normalization: { offset: 10, range: 20 }
}
```

**`minTeamSampleCount`**:
- **Lower (30)**: Include more team data, potentially noisier
- **Default (50)**: Balanced reliability
- **Higher (100)**: Only highly-played teams, very reliable but less coverage

**`normalization`**: Controls how raw synergy scores map to [0, 1]. Generally leave as default unless you understand the formula.

---

### Counter-Meta Configuration

```javascript
counterMetaConfig: {
  minMatchupSampleCount: 30,
  defaultScore: 0.5
}
```

**`minMatchupSampleCount`**:
- **Lower (20)**: More matchup data included, less reliable
- **Default (30)**: Balanced
- **Higher (50)**: Only high-confidence matchups, more conservative

**`defaultScore`**: What to assume when no matchup data exists (0.5 = neutral is safest).

---

### Tier Percentiles

```javascript
tierPercentiles: {
  S: 0.10,  // Top 10%
  A: 0.20,  // Next 20%
  B: 0.40,  // Next 40%
  C: 0.20,  // Next 20%
  F: 0.10   // Bottom 10%
}
```

**What it does**: Determines how many brawlers go in each tier.

**Alternative Distributions**:

**Strict** (fewer S-tiers):
```javascript
{ S: 0.05, A: 0.15, B: 0.40, C: 0.25, F: 0.15 }
```

**Generous** (more S/A tiers):
```javascript
{ S: 0.15, A: 0.25, B: 0.35, C: 0.15, F: 0.10 }
```

**Flat** (equal distribution):
```javascript
{ S: 0.20, A: 0.20, B: 0.20, C: 0.20, F: 0.20 }
```

**Constraints**: Must sum to **1.0** (100%)

---

## Testing Your Changes

### 1. Validate Configuration

```bash
node -e "const config = require('./config/ranking.config.js'); console.log('Config loaded successfully')"
```

### 2. Run Unit Tests

```bash
npm test
```

All tests should still pass. If not, you may have broken a constraint (e.g., weights not summing to 1.0).

### 3. Test Specific Map

```bash
# Start server
npm start

# In another terminal, test a map
curl "http://localhost:3000/api/map/15000000"
```

Compare rankings before/after your changes.

### 4. Monitor Impact

Look for:
- **CPS score distribution**: Should remain roughly 0.3-0.8 range
- **Tier distribution**: Should match your percentile config
- **Ranking changes**: Expected shifts based on your parameter changes

---

## Rollback

If changes produce unexpected results:

1. **Git Revert** (if using version control):
   ```bash
   git checkout config/ranking.config.js
   ```

2. **Manual Restore**:
   - Copy default values from `ALGORITHM.md` reference section
   - Or restore from backup

3. **Restart Server**:
   ```bash
   npm start
   ```

---

## Advanced Tuning

### Dynamic Weight Adjustment

For automated tuning, you could:
1. Create multiple config profiles (e.g., `ranking.config.competitive.js`, `ranking.config.casual.js`)
2. Switch via environment variable
3. A/B test different configurations
4. Use ML to optimize weights based on competitive outcomes

### Per-Map Tuning

Currently, weights are per **mode type**. For map-specific tuning:
1. Extend `getMapTypeWeights()` to accept map ID
2. Create map-specific weight overrides in config
3. Useful for very unique maps (e.g., specific showdown maps favor different playstyles)

---

## Parameter Impact Summary

| Parameter | Impact on Rankings | Sensitivity |
|-----------|-------------------|-------------|
| `halfLifeDays` | High - changes time emphasis | High |
| `mapWeights` | Very High - reshuffles entire ranking | Very High |
| `bayesianPriors` | Medium - affects confidence | Medium |
| `useRateThresholds` | Medium - changes meta classification | Medium |
| `tierPercentiles` | High - changes tier cutoffs | High |
| `minTeamSampleCount` | Low - affects data reliability | Low |
| `minMatchupSampleCount` | Low - affects data reliability | Low |

**Start with**: Time weighting and map weights (highest impact, easiest to understand).

---

## Getting Help

- **Documentation**: See `ALGORITHM.md` for detailed explanations
- **Issues**: Check test results after changes
- **Community**: Share configurations and insights with other users

---

**Last Updated**: February 2024
**Guide Version**: 1.0
