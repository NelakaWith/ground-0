/**
 * Calculates the similarity between two strings using Dice's Coefficient.
 * Returns a value between 0 (completely different) and 1 (exact match).
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a.toLowerCase());
  const bigramsB = getBigrams(b.toLowerCase());

  let intersect = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersect++;
  }

  return (2 * intersect) / (bigramsA.size + bigramsB.size);
}
