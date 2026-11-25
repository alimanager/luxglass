/** Evaluation metrics for binary feedback. */

/** Area under the ROC curve (Mann–Whitney, ties count half). 0.5 = random. */
export function auc(scores: readonly number[], labels: readonly (0 | 1 | boolean)[]): number {
  const idx = scores.map((_, i) => i).sort((a, b) => scores[a] - scores[b]);
  let pos = 0;
  let neg = 0;
  let rankSum = 0;
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && scores[idx[j + 1]] === scores[idx[i]]) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) {
      if (labels[idx[k]]) {
        pos++;
        rankSum += avgRank;
      } else neg++;
    }
    i = j + 1;
  }
  if (pos === 0 || neg === 0) return 0.5;
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

/** Share of correct predictions with `score >= threshold` meaning "like". */
export function accuracy(scores: readonly number[], labels: readonly (0 | 1 | boolean)[], threshold: number): number {
  let ok = 0;
  scores.forEach((s, i) => {
    if (s >= threshold === Boolean(labels[i])) ok++;
  });
  return scores.length ? ok / scores.length : 0;
}

/** Mean negative log-likelihood of probabilities in (0, 1). */
export function logLoss(probs: readonly number[], labels: readonly (0 | 1 | boolean)[]): number {
  let s = 0;
  probs.forEach((p, i) => {
    const q = Math.min(1 - 1e-7, Math.max(1e-7, p));
    s -= labels[i] ? Math.log(q) : Math.log(1 - q);
  });
  return probs.length ? s / probs.length : 0;
}
