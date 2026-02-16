/**
 * Performance Benchmark for Ranking Algorithm
 *
 * Measures calculation time, memory usage, and validates < 100ms requirement.
 */

const { performance } = require('perf_hooks');
const {
  calculateBayesianConfidence,
  calculateTimeWeightedWinRate,
  calculatePairwiseSynergy,
  calculateUseRateScore,
  calculateCounterMetaScore,
  computeCPS,
  assignTiers
} = require('./lib/rankingEngine');
const { mean, standardDeviation } = require('./lib/statistics');

// Mock data generators
function generateMockBrawler(id) {
  return {
    name: `Brawler${id}`,
    winRate: 45 + Math.random() * 10,
    adjustedWinRate: 45 + Math.random() * 10,
    useRate: 5 + Math.random() * 20,
    count: Math.floor(500 + Math.random() * 1500)
  };
}

function generateMockTeams(brawlerNames, count = 50) {
  const teams = [];
  for (let i = 0; i < count; i++) {
    const teamSize = 3;
    const brawlers = [];
    for (let j = 0; j < teamSize; j++) {
      brawlers.push(brawlerNames[Math.floor(Math.random() * brawlerNames.length)]);
    }
    teams.push({
      brawlers: Array.from(new Set(brawlers)), // Remove duplicates
      winRate: 45 + Math.random() * 10,
      adjustedWinRate: 45 + Math.random() * 10,
      count: Math.floor(50 + Math.random() * 200)
    });
  }
  return teams;
}

// Benchmark functions
function benchmarkComponent(name, fn, iterations = 1000) {
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    fn();
  }

  const end = performance.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;

  return { name, totalTime, avgTime, iterations };
}

function benchmarkFullPipeline(brawlerCount, teamCount = 100) {
  const brawlers = Array.from({ length: brawlerCount }, (_, i) => generateMockBrawler(i));
  const brawlerNames = brawlers.map(b => b.name);
  const teams = generateMockTeams(brawlerNames, teamCount);
  const mapMode = 'Gem Grab';

  const memBefore = process.memoryUsage();
  const start = performance.now();

  // Simulate full ranking pipeline
  const rankedBrawlers = brawlers.map(brawler => {
    const cps = computeCPS(brawler, brawlers, teams, mapMode);
    return { ...brawler, cps };
  });

  const tiered = assignTiers(rankedBrawlers);

  const end = performance.now();
  const memAfter = process.memoryUsage();

  const time = end - start;
  const memDelta = {
    heapUsed: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024,
    external: (memAfter.external - memBefore.external) / 1024 / 1024
  };

  return { brawlerCount, teamCount, time, memory: memDelta, tiers: tiered.slice(0, 5) };
}

// Run benchmarks
console.log('='.repeat(80));
console.log('BrawlFast Ranking Algorithm Performance Benchmark');
console.log('='.repeat(80));
console.log();

console.log('Component Benchmarks (1000 iterations each)');
console.log('-'.repeat(80));

const componentResults = [
  benchmarkComponent('calculateBayesianConfidence', () =>
    calculateBayesianConfidence(500, 500)
  ),
  benchmarkComponent('calculateTimeWeightedWinRate', () => {
    const now = Date.now();
    const games = Array.from({ length: 100 }, (_, i) => ({
      isWin: Math.random() > 0.5,
      timestamp: now - i * 24 * 60 * 60 * 1000
    }));
    return calculateTimeWeightedWinRate(games);
  }),
  benchmarkComponent('mean', () => {
    const values = Array.from({ length: 60 }, () => Math.random() * 100);
    return mean(values);
  }),
  benchmarkComponent('standardDeviation', () => {
    const values = Array.from({ length: 60 }, () => Math.random() * 100);
    return standardDeviation(values);
  })
];

componentResults.forEach(result => {
  console.log(`${result.name.padEnd(35)} ${result.avgTime.toFixed(4)}ms avg`);
});

console.log();
console.log('Full Pipeline Benchmarks');
console.log('-'.repeat(80));

const pipelineResults = [
  benchmarkFullPipeline(20, 50),   // Small map
  benchmarkFullPipeline(40, 100),  // Medium map
  benchmarkFullPipeline(60, 150),  // Full roster
  benchmarkFullPipeline(60, 300)   // Full roster + lots of teams
];

pipelineResults.forEach(result => {
  const passed = result.time < 100 ? '✓ PASS' : '✗ FAIL';
  const memUsed = result.memory.heapUsed.toFixed(2);

  console.log(`${result.brawlerCount} brawlers, ${result.teamCount} teams:`.padEnd(35))
  console.log(`  Time: ${result.time.toFixed(2)}ms ${passed}`);
  console.log(`  Memory: ${memUsed}MB heap`);
  console.log(`  Top 5 tiers: ${result.tiers.map(b => b.tier).join(', ')}`);
  console.log();
});

console.log('='.repeat(80));
console.log('Performance Summary');
console.log('='.repeat(80));

const maxTime = Math.max(...pipelineResults.map(r => r.time));
const avgTime = pipelineResults.reduce((sum, r) => sum + r.time, 0) / pipelineResults.length;
const requirement = 100; // ms

console.log(`Requirement: < ${requirement}ms for typical map`);
console.log(`Maximum time: ${maxTime.toFixed(2)}ms`);
console.log(`Average time: ${avgTime.toFixed(2)}ms`);
console.log(`Status: ${maxTime < requirement ? '✓ PASSED' : '✗ FAILED'}`);
console.log();

if (maxTime < requirement) {
  const margin = ((requirement - maxTime) / requirement * 100).toFixed(1);
  console.log(`Performance margin: ${margin}% below requirement`);
} else {
  const excess = ((maxTime - requirement) / requirement * 100).toFixed(1);
  console.log(`⚠️  Performance exceeds requirement by ${excess}%`);
  console.log('Consider optimizing or increasing cache TTL');
}

console.log();
console.log('Component Performance Analysis:');
console.log('-'.repeat(80));

const totalComponentTime = componentResults.reduce((sum, r) => sum + r.avgTime, 0);
componentResults.forEach(result => {
  const percentage = (result.avgTime / totalComponentTime * 100).toFixed(1);
  console.log(`${result.name.padEnd(35)} ${percentage.padStart(5)}% of total`);
});

console.log();
console.log('Benchmark complete!');
console.log('='.repeat(80));
