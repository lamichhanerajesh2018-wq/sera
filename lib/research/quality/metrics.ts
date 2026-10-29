export interface BinaryObservation {
  expected: boolean;
  predicted: boolean;
}

export function safeDivide(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0;
}

export function confusionMatrix(items: BinaryObservation[]) {
  let truePositive = 0;
  let falsePositive = 0;
  let trueNegative = 0;
  let falseNegative = 0;
  for (const item of items) {
    if (item.expected && item.predicted) truePositive += 1;
    else if (!item.expected && item.predicted) falsePositive += 1;
    else if (!item.expected && !item.predicted) trueNegative += 1;
    else falseNegative += 1;
  }
  const precision = safeDivide(truePositive, truePositive + falsePositive);
  const recall = safeDivide(truePositive, truePositive + falseNegative);
  return {
    truePositive, falsePositive, trueNegative, falseNegative,
    precision, recall,
    f1: safeDivide(2 * precision * recall, precision + recall),
    accuracy: safeDivide(truePositive + trueNegative, items.length),
  };
}

export function fieldAccuracy(values: Array<"correct" | "incorrect" | "unsupported" | undefined>) {
  const reviewed = values.filter(Boolean);
  return {
    reviewed: reviewed.length,
    correct: reviewed.filter((value) => value === "correct").length,
    unsupported: reviewed.filter((value) => value === "unsupported").length,
    accuracy: safeDivide(reviewed.filter((value) => value === "correct").length, reviewed.length),
  };
}

export interface DeduplicationObservation {
  expectedSame: boolean;
  predictedSame: boolean;
  uncertain?: boolean;
  relatedExpected?: boolean;
  relatedPredicted?: boolean;
  canonicalImproved?: boolean;
  canonicalDegraded?: boolean;
  similarity?: number;
  judgeConfidence?: number;
}

export function deduplicationMetrics(items: DeduplicationObservation[]) {
  const matrix = confusionMatrix(items.map((item) => ({ expected: item.expectedSame, predicted: item.predictedSame })));
  return {
    correctMerges: matrix.truePositive,
    incorrectMerges: matrix.falsePositive,
    correctSeparations: matrix.trueNegative,
    missedDuplicates: matrix.falseNegative,
    mergePrecision: matrix.precision,
    duplicateRecall: matrix.recall,
    pairwiseAccuracy: matrix.accuracy,
    uncertainReviewRate: safeDivide(items.filter((item) => item.uncertain).length, items.length),
    relatedButDistinctAccuracy: safeDivide(
      items.filter((item) => item.relatedExpected && item.relatedPredicted).length,
      items.filter((item) => item.relatedExpected).length,
    ),
    canonicalWordingImprovementAccuracy: safeDivide(
      items.filter((item) => item.canonicalImproved && !item.canonicalDegraded).length,
      items.filter((item) => item.canonicalImproved || item.canonicalDegraded).length,
    ),
    canonicalWordingDegradationRate: safeDivide(
      items.filter((item) => item.canonicalDegraded).length,
      items.length,
    ),
  };
}

export function numericBucket(value: number | undefined, width = 0.1) {
  if (value === undefined) return "unknown";
  const lower = Math.floor(value / width) * width;
  const upper = Math.min(1, lower + width);
  return `${lower.toFixed(1)}-${upper.toFixed(1)}`;
}

export function metricsByBucket<T>(
  items: T[],
  bucket: (item: T) => string,
  calculate: (items: T[]) => Record<string, unknown>,
) {
  const grouped = new Map<string, T[]>();
  for (const item of items) grouped.set(bucket(item), [...(grouped.get(bucket(item)) || []), item]);
  return Object.fromEntries([...grouped.entries()].map(([key, values]) => [key, calculate(values)]));
}

export function thresholdCalibration(
  observations: Array<{ score: number; expectedPositive: boolean }>,
  currentThreshold: number,
) {
  const thresholds = [...new Set([currentThreshold, ...observations.map((item) => item.score)])].sort((a, b) => a - b);
  const candidates = thresholds.map((threshold) => {
    const metrics = confusionMatrix(observations.map((item) => ({
      expected: item.expectedPositive,
      predicted: item.score >= threshold,
    })));
    return { threshold, ...metrics, falseMergeRisk: 1 - metrics.precision, falseNegativeRisk: 1 - metrics.recall };
  });
  const safe = candidates.filter((item) => item.precision >= 0.95).sort((a, b) => b.recall - a.recall)[0];
  return {
    currentThreshold,
    evaluatedSampleSize: observations.length,
    current: candidates.find((item) => item.threshold === currentThreshold),
    recommendedThresholdRange: safe ? [safe.threshold, Math.min(1, safe.threshold + 0.05)] : null,
    recommendationConfidence: observations.length >= 100 ? "high" : observations.length >= 30 ? "medium" : "low",
    candidates,
  };
}

export function reviewerAgreement(labels: Array<{ item: string; reviewer: string; label: string }>) {
  const grouped = new Map<string, string[]>();
  for (const row of labels) grouped.set(row.item, [...(grouped.get(row.item) || []), row.label]);
  const comparable = [...grouped.values()].filter((values) => values.length >= 2).map((values) => values.slice(0, 2));
  const agreement = safeDivide(comparable.filter(([left, right]) => left === right).length, comparable.length);
  const allLabels = comparable.flat();
  const frequencies = new Map<string, number>();
  for (const label of allLabels) frequencies.set(label, (frequencies.get(label) || 0) + 1);
  const expectedAgreement = [...frequencies.values()].reduce((sum, count) => {
    const probability = safeDivide(count, allLabels.length);
    return sum + probability * probability;
  }, 0);
  const disagreementRate = comparable.length ? 1 - agreement : 0;
  const cohensKappa = !comparable.length ? 0
    : expectedAgreement === 1 ? (agreement === 1 ? 1 : 0)
      : safeDivide(agreement - expectedAgreement, 1 - expectedAgreement);
  return {
    comparableItems: comparable.length,
    agreement,
    disagreementRate,
    cohensKappa,
  };
}
