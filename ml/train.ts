import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadTemplates, ML_DIR } from './data';
import { buildFrameVocab, frameVector, toJsonl, type GabaritTemplate } from './feedback';
import { accuracy, auc, logLoss } from './metrics';
import { blend, predictProba, serializeModel, topInteractions, trainModel, type LearnedModel, type TrainExample } from './model';
import { createRng } from './rng';
import { ruleScore } from './ruleBaseline';
import { simulate, type SimData, type SimRating } from './simulate';

/**
 * Simulate feedback, train the learned model, compare it with the expert rules on users it
 * has never seen, and write ml/out/model.json.  Usage: npx tsx ml/train.ts [users] [seed]
 */

export interface Evaluation {
  n: number;
  likeRate: number;
  auc: number;
  /** mean AUC inside each user's own ratings: "does it rank frames right for this person" */
  userAuc: number;
  accuracy: number;
  logLoss?: number;
}

export function evaluate(ratings: readonly SimRating[], scores: readonly number[], threshold: number, probs?: readonly number[]): Evaluation {
  const labels = ratings.map((r) => r.like);
  const byUser = new Map<number, number[]>();
  ratings.forEach((r, i) => byUser.set(r.user, [...(byUser.get(r.user) ?? []), i]));
  const perUser = [...byUser.values()]
    .filter((ix) => ix.some((i) => labels[i]) && ix.some((i) => !labels[i]))
    .map((ix) => auc(ix.map((i) => scores[i]), ix.map((i) => labels[i])));
  return {
    n: ratings.length,
    likeRate: labels.filter(Boolean).length / labels.length,
    auc: auc(scores, labels),
    userAuc: perUser.reduce((s, x) => s + x, 0) / Math.max(1, perUser.length),
    accuracy: accuracy(scores, labels, threshold),
    ...(probs ? { logLoss: logLoss(probs, labels) } : {}),
  };
}

export function splitUsers(nUsers: number, seed: number, fractions = [0.7, 0.15]) {
  const ids = createRng(seed).shuffle(Array.from({ length: nUsers }, (_, i) => i));
  const a = Math.round(nUsers * fractions[0]);
  const b = a + Math.round(nUsers * fractions[1]);
  return { train: new Set(ids.slice(0, a)), val: new Set(ids.slice(a, b)), test: new Set(ids.slice(b)) };
}

export function examplesFor(sim: SimData, templates: readonly GabaritTemplate[], users: Set<number>, vocab = buildFrameVocab(templates)) {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const frames = new Map(templates.map((t) => [t.id, frameVector(t, vocab)]));
  const ratings = sim.ratings.filter((r) => users.has(r.user));
  const examples: TrainExample[] = ratings.map((r) => ({ face: sim.users[r.user].face, frame: frames.get(r.templateId)!, y: r.like ? 1 : 0 }));
  return { ratings, examples, byId, frames };
}

export function run(opts: { users?: number; perUser?: number; seed?: number; epochs?: number; l2Grid?: number[]; log?: (s: string) => void } = {}) {
  const log = opts.log ?? (() => {});
  const templates = loadTemplates();
  const vocab = buildFrameVocab(templates);
  const users = opts.users ?? 1200;
  const seed = opts.seed ?? 42;
  const t0 = Date.now();
  const sim = simulate(templates, { users, perUser: opts.perUser ?? 30, seed });
  log(`simulation : ${users} visages × ${opts.perUser ?? 30} avis = ${sim.ratings.length} avis sur ${templates.length} gabarits (${Date.now() - t0} ms)`);
  const shapes = new Map<string, number>();
  sim.users.forEach((u) => shapes.set(u.metrics.shape, (shapes.get(u.metrics.shape) ?? 0) + 1));
  log(`formes : ${[...shapes].map(([k, v]) => `${k} ${v}`).join(', ')}`);

  const split = splitUsers(users, seed + 1);
  const tr = examplesFor(sim, templates, split.train, vocab);
  const va = examplesFor(sim, templates, split.val, vocab);
  const te = examplesFor(sim, templates, split.test, vocab);
  const epochs = opts.epochs ?? 25;
  const common = { vocab, epochs, seed, source: 'simulated' as const, nFeedback: 0 };

  // L2 chosen on validation users
  let best = { l2: 0, auc: -1 };
  for (const l2 of opts.l2Grid ?? [1e-4, 1e-3, 1e-2]) {
    const m = trainModel(tr.examples, { ...common, l2 });
    const p = va.examples.map((e) => predictProba(m, e.face, e.frame));
    const a = auc(p, va.ratings.map((r) => r.like));
    log(`  l2 = ${l2} → AUC validation ${a.toFixed(3)}`);
    if (a > best.auc) best = { l2, auc: a };
  }
  const model = trainModel([...tr.examples, ...va.examples], { ...common, l2: best.l2 });

  // held-out users only
  const probs = te.examples.map((e) => predictProba(model, e.face, e.frame));
  const learnedScores = probs.map((p) => Math.round(100 * p));
  const rules = te.ratings.map((r) => ruleScore(sim.users[r.user].metrics, te.byId.get(r.templateId)!));
  const random = createRng(seed + 2);
  const results = {
    random: evaluate(te.ratings, te.ratings.map(() => random.next()), 0.5),
    rules: evaluate(te.ratings, rules, 50),
    learned: evaluate(te.ratings, learnedScores, 50, probs),
    blend50: evaluate(te.ratings, rules.map((r, i) => blend(r, learnedScores[i], 2000)), 50),
    oracle: evaluate(te.ratings, te.ratings.map((r) => r.p), 0.5, te.ratings.map((r) => r.p)),
  };
  return { model: { ...model, metrics: { split: 'par utilisateur 70/15/15', l2: best.l2, test: results } } as LearnedModel, results, sim, templates };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(ML_DIR, 'train.ts');
if (isMain) {
  const t0 = Date.now();
  const users = Number(process.argv[2] ?? 1200);
  const seed = Number(process.argv[3] ?? 42);
  const { model, results, sim } = run({ users, seed, log: console.log });
  const fmt = (x: number | undefined) => (x === undefined ? '  –  ' : x.toFixed(3));
  console.log('\nutilisateurs jamais vus (test)  AUC    AUC/utilisateur  précision  log-loss');
  for (const [name, r] of Object.entries(results)) {
    console.log(`  ${name.padEnd(30)} ${fmt(r.auc)}  ${fmt(r.userAuc)}            ${fmt(r.accuracy)}      ${fmt(r.logLoss)}`);
  }
  console.log(`  (taux de "ça me va" : ${(results.learned.likeRate * 100).toFixed(1)} %, ${results.learned.n} avis)`);
  console.log('\ninteractions les plus fortes :');
  for (const x of topInteractions(model, 8)) console.log(`  ${x.face} × ${x.frame} : ${x.w}`);

  const out = resolve(ML_DIR, 'out');
  mkdirSync(out, { recursive: true });
  const json = serializeModel(model);
  writeFileSync(resolve(out, 'model.json'), json + '\n');
  writeFileSync(resolve(out, 'sample-feedback.jsonl'), toJsonl(sim.events.slice(0, 12)));
  console.log(`\nml/out/model.json : ${(json.length / 1024).toFixed(1)} kB · ml/out/sample-feedback.jsonl · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (json.length > 50 * 1024) {
    console.error('model.json dépasse 50 kB');
    process.exit(1);
  }
}
