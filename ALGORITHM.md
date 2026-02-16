# BrawlFast Advanced Ranking Algorithm

## Overview

The BrawlFast ranking system uses a sophisticated **Competitive Performance Score (CPS)** to rank brawlers for specific maps and game modes. Unlike simple win-rate rankings, CPS incorporates statistical confidence, temporal relevance, team synergy, meta positioning, and counter-pick value to provide nuanced, actionable recommendations.

**Key Innovation**: The algorithm adapts its ranking weights based on game mode characteristics, emphasizing individual performance in Showdown but team synergy in Gem Grab.

## Core Components

### 1. Bayesian Confidence Calculation

**Purpose**: Quantify the reliability of win rate estimates based on sample size.

**Problem**: A brawler with 100% win rate over 5 games is less reliable than one with 55% over 1000 games.

**Solution**: Use Beta distribution to model win rate uncertainty.

#### Formula

```
α = wins + priorWins
β = losses + priorLosses
variance = (α × β) / (total² × (total + 1))
stdDev = √variance
intervalWidth = 4 × stdDev  // ~95% credible interval
confidence = max(0, 1 - intervalWidth)
```

**Default Priors**: `priorWins = 50`, `priorLosses = 50` (assumes neutral 50% win rate)

#### Interpretation

- **Confidence = 0.95**: Very reliable estimate (large sample)
- **Confidence = 0.70**: Moderate reliability (medium sample)
- **Confidence = 0.50**: Low reliability (small sample)

**Impact**: Final CPS is multiplied by confidence, so uncertain data is automatically down-weighted.

---

### 2. Time-Weighted Performance

**Purpose**: Emphasize recent games to adapt quickly to balance changes and meta shifts.

**Problem**: A brawler nerfed 2 weeks ago may still show high historical win rates.

**Solution**: Exponential decay weighting.

#### Formula

```
For each game:
  daysAgo = (now - gameTimestamp) / (1 day in ms)
  weight = e^(-daysAgo / halfLife)

weightedWinRate = (Σ weight_i × isWin_i) / (Σ weight_i) × 100
```

**Default Half-Life**: 14 days (games from 2 weeks ago have 50% weight)

#### Examples

| Days Ago | Weight (14-day half-life) |
|----------|---------------------------|
| 0 (today) | 100% |
| 7 | 76% |
| 14 | 50% |
| 28 | 25% |
| 56 | 6% |

**Fallback**: If no timestamp data available, uses static adjusted win rate.

---

### 3. Map-Aware Weighting System

**Purpose**: Different game modes require different strategic emphases.

**Problem**: A strong solo brawler (Edgar) may dominate Showdown but underperform in Gem Grab.

**Solution**: Dynamic weight allocation based on mode type.

#### Weight Categories

1. **Performance** (0.4 - 0.75): Individual win rate contribution
2. **Synergy** (0.05 - 0.35): Team composition compatibility
3. **Popularity** (0.1 - 0.15): Meta relevance and use rate
4. **Counter** (0.1 - 0.15): Anti-meta strength

#### Mode-Specific Weights

| Mode | Performance | Synergy | Popularity | Counter | Rationale |
|------|------------|---------|-----------|---------|-----------|
| **Showdown** | 0.75 | 0.05 | 0.10 | 0.10 | Solo mode: individual skill dominates |
| **Gem Grab** | 0.40 | 0.35 | 0.15 | 0.10 | Team coordination critical |
| **Hot Zone** | 0.40 | 0.35 | 0.15 | 0.10 | Similar to Gem Grab |
| **Heist** | 0.60 | 0.10 | 0.15 | 0.15 | Specialist brawlers excel |
| **Brawl Ball** | 0.50 | 0.20 | 0.15 | 0.15 | Balanced team mode |
| **Bounty** | 0.50 | 0.20 | 0.15 | 0.15 | Balanced team mode |
| **Knockout** | 0.50 | 0.20 | 0.15 | 0.15 | Balanced team mode |

All weights sum to **1.0** for each mode.

---

### 4. Pairwise Team Synergy

**Purpose**: Identify brawlers that perform exceptionally well (or poorly) in specific team compositions.

**Problem**: Some brawlers have high individual win rates but poor synergy (e.g., Edgar). Others excel in teams (e.g., Poco).

**Solution**: Analyze team performance vs. expected individual performance.

#### Formula

```
For each team containing the brawler:
  synergy = teamWinRate - myWinRate - partnerWinRate + 50
  weight = ln(teamPlayCount)  // Log-weight by popularity

avgSynergy = Σ(synergy × weight) / Σ(weight)
normalizedSynergy = clamp((avgSynergy + 10) / 20, 0, 1)
```

**Interpretation**:
- **Synergy > 0.6**: Strong team player (e.g., Poco)
- **Synergy = 0.5**: Neutral
- **Synergy < 0.4**: Better solo (e.g., Edgar)

**Sample Filter**: Only considers teams with >50 games to avoid noise.

---

### 5. Use Rate Intelligence

**Purpose**: Classify brawlers by meta positioning using statistical analysis.

**Problem**: High use rate doesn't always mean strong (could be "noob trap"). Low use rate doesn't always mean weak (could be "hidden gem").

**Solution**: Z-score analysis to identify outliers.

#### Categories

**Z-scores**:
```
zUse = (useRate - meanUse) / stdDevUse
zWin = (winRate - meanWin) / stdDevWin
```

**Classification**:

1. **Meta Strength** (zUse > 0.5 AND zWin > 0.5):
   - High use + high win
   - Score: 0.8 - 1.0
   - Example: Belle in her prime

2. **Sleeper Pick** (zWin > 0.5 AND zUse < -0.5):
   - Low use + high win (underrated)
   - Score: 0.7 - 1.0
   - Example: Gale before pros discovered him

3. **Trap Pick** (zUse > 0.5 AND zWin < -0.5):
   - High use + low win (overrated/easy to play)
   - Score: 0.2
   - Example: Edgar in competitive

4. **Neutral** (everything else):
   - Score: 0.5 ± 0.1 × zWin

---

### 6. Counter-Meta Score

**Purpose**: Reward brawlers that counter popular enemy picks.

**Problem**: A brawler might have a 50% overall win rate but a 70% win rate against the current meta.

**Solution**: Weighted average of win rates against popular enemies.

#### Formula

```
For each matchup with >30 sample games:
  if opponent is popular (or all considered):
    weight = ln(sampleCount)
    weightedWinRate += matchupWinRate × weight

counterScore = (Σ weightedWinRate) / (Σ weight) / 100
```

**Default**: Returns 0.5 (neutral) if no matchup data available.

**Future Enhancement**: Dynamically identify "popular enemies" from current meta use rates.

---

### 7. CPS Formula (Putting It All Together)

**Purpose**: Combine all factors into a single ranking score.

#### Step-by-Step Calculation

```javascript
// 1. Gather component scores
timeWeightedWR = calculateTimeWeightedWinRate(recentGames) ?? winRate
confidence = calculateBayesianConfidence(wins, losses)
synergyScore = calculatePairwiseSynergy(brawler, teams)
useRateScore = calculateUseRateScore(useRate, winRate, stats)
counterScore = calculateCounterMetaScore(matchups)

// 2. Get map-specific weights
weights = getMapTypeWeights(mapMode)

// 3. Weighted combination
baseCPS =
  (weights.performance × timeWeightedWR/100) +
  (weights.synergy × synergyScore) +
  (weights.popularity × useRateScore) +
  (weights.counter × counterScore)

// 4. Apply confidence multiplier
finalCPS = baseCPS × confidence
```

#### Example Calculation

**Brawler**: Belle on Gem Grab
**Stats**: 55% win rate (1000 games), 15% use rate, strong teams
**Weights**: Performance=0.4, Synergy=0.35, Popularity=0.15, Counter=0.1

```
timeWeightedWR = 55% = 0.55
confidence = 0.92 (high sample count)
synergyScore = 0.68 (good team player)
useRateScore = 0.75 (above average on both)
counterScore = 0.58 (slightly favored matchups)

baseCPS =
  (0.4 × 0.55) +
  (0.35 × 0.68) +
  (0.15 × 0.75) +
  (0.1 × 0.58)
  = 0.22 + 0.238 + 0.1125 + 0.058
  = 0.6285

finalCPS = 0.6285 × 0.92 = 0.578
```

**Result**: Belle scores **0.578** on Gem Grab → likely **A or B tier**.

---

### 8. Percentile-Based Tier Assignment

**Purpose**: Distribute brawlers into tiers (S/A/B/C/F) for easy interpretation.

**Problem**: Standard deviation-based tiers create inconsistent distributions (sometimes 20 S-tiers, sometimes 0).

**Solution**: Fixed percentile cutoffs.

#### Distribution

| Tier | Percentile | % of Brawlers | Description |
|------|-----------|---------------|-------------|
| **S** | Top 10% | 10% | Elite picks, highest win probability |
| **A** | 10-30% | 20% | Strong picks, very viable |
| **B** | 30-70% | 40% | Solid picks, map-dependent |
| **C** | 70-90% | 20% | Weak picks, niche use cases |
| **F** | Bottom 10% | 10% | Avoid, significant disadvantage |

**Guarantee**: At least 1 brawler in S-tier, even if pool is small.

#### Algorithm

```javascript
1. Sort brawlers by CPS (descending)
2. Calculate tier sizes from percentiles
3. Assign tiers based on position in sorted list
```

**Example** (20 brawlers):
- S-tier: Top 2 (10%)
- A-tier: Next 4 (20%)
- B-tier: Next 8 (40%)
- C-tier: Next 4 (20%)
- F-tier: Bottom 2 (10%)

---

## Performance Characteristics

### Computational Complexity

| Function | Complexity | Notes |
|----------|-----------|-------|
| `calculateBayesianConfidence` | O(1) | Simple arithmetic |
| `calculateTimeWeightedWinRate` | O(n) | n = number of games |
| `calculatePairwiseSynergy` | O(t × p) | t = teams, p = partners/team |
| `calculateUseRateScore` | O(1) | Z-score calculation |
| `calculateCounterMetaScore` | O(m) | m = matchups |
| `computeCPS` | O(n + t×p + m) | Combines above |
| `assignTiers` | O(b log b) | b = brawlers, due to sort |

**Total for 20 brawlers**: O(b log b + b × (n + t×p + m))
**Typical**: ~10ms for map with 60 brawlers

### Cache Strategy

The BrawlFast server caches:
1. **Raw API responses** (30 min TTL)
2. **Computed CPS scores** (implicit in response)
3. **Brawler catalog** (6 hour TTL)

**Result**: Most requests served in <5ms from cache.

---

## Data Requirements

### Required Fields

- `winRate`: Win rate percentage (0-100)
- `useRate`: Use rate percentage (0-100)
- `count`: Total games played (for confidence)

### Optional Fields (Graceful Degradation)

- `recentGames`: Array of `{isWin, timestamp}` → Falls back to `winRate`
- `matchups`: Array of `{opponent, winRate, sampleCount}` → Falls back to 0.5 (neutral)
- `adjustedWinRate`: Bayesian-adjusted rate → Falls back to `winRate`

### Team Data

- `teams`: Array of `{brawlers, winRate, count}`
- Used for synergy calculation
- Not strictly required (synergy = 0 if missing)

---

## Configuration & Tuning

All parameters are configurable in `config/ranking.config.js`:

### Key Parameters

| Parameter | Default | Purpose | Tuning Guidance |
|-----------|---------|---------|-----------------|
| `bayesianPriors.wins` | 50 | Prior wins assumption | Increase for more conservative confidence |
| `bayesianPriors.losses` | 50 | Prior losses assumption | Keep equal to wins for neutral prior |
| `timeWeighting.halfLifeDays` | 14 | Temporal decay rate | Decrease for faster meta adaptation (e.g., 7 days post-patch) |
| `mapWeights.*` | Varies | Mode-specific weights | Adjust based on competitive insights |
| `useRateThresholds.*` | 0.5 | Z-score cutoffs | Tighten (increase) for stricter classification |
| `tierPercentiles.*` | 10/20/40/20/10 | Tier distribution | Adjust for different tier philosophies |

See `TUNING.md` for detailed tuning scenarios.

---

## Algorithm Evolution

### Version History

**v1.0** (Initial): Simple win rate + Bayesian adjustment
**v2.0** (Current): Full advanced system with 7 components

### Future Enhancements

1. **ML Weight Optimization**: Train optimal weights per map using historical data
2. **Confidence Intervals in UI**: Show uncertainty ranges (e.g., "55% ± 3%")
3. **Temporal Meta Tracking**: Track how brawler strength changes over time
4. **Automated Popular Enemy Detection**: Identify meta threats dynamically
5. **Player Skill Adjustment**: Account for user skill level in recommendations
6. **Composition Optimization**: Suggest full team compositions, not just individual picks

---

## Testing

The ranking algorithm has **70 unit tests** covering:
- Statistical accuracy
- Edge case handling (empty data, extreme values)
- Integration between components
- Map-specific weight validation
- Tier distribution correctness

Run tests:
```bash
npm test
```

Coverage target: **>80%** for all ranking functions

---

## References

- [Beta Distribution (Wikipedia)](https://en.wikipedia.org/wiki/Beta_distribution)
- [Bayesian Inference](https://en.wikipedia.org/wiki/Bayesian_inference)
- [Exponential Decay](https://en.wikipedia.org/wiki/Exponential_decay)
- [Z-Score Standardization](https://en.wikipedia.org/wiki/Standard_score)
- Brawl Stars balance history and meta analysis

---

## License

This algorithm is part of the BrawlFast project. See main README for license details.

---

**Last Updated**: February 2026
**Algorithm Version**: 2.0
**Maintainer**: BrawlFast Development Team
