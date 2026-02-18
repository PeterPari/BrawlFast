/**
 * Search and Fuzzy Matching Utilities
 */

function levenshtein(a, b) {
  const lenA = a.length;
  const lenB = b.length;

  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const dp = Array.from({ length: lenA + 1 }, () => new Array(lenB + 1).fill(0));

  for (let i = 0; i <= lenA; i += 1) dp[i][0] = i;
  for (let j = 0; j <= lenB; j += 1) dp[0][j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[lenA][lenB];
}

function scoreMatch(queryNorm, targetNorm) {
  if (!queryNorm || !targetNorm) return null;

  if (targetNorm.startsWith(queryNorm)) {
    return 100;
  }

  if (targetNorm.includes(queryNorm)) {
    return 80;
  }

  const distance = levenshtein(queryNorm, targetNorm);
  if (distance <= 2) {
    return 60 - distance * 10;
  }

  return null;
}

function topScored(items, queryNorm, limit = 8) {
  return items
    .map((item) => {
      const score = scoreMatch(queryNorm, item._norm);
      if (score == null) return null;
      return { score, item };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map((entry) => entry.item);
}

module.exports = {
  levenshtein,
  scoreMatch,
  topScored
};
