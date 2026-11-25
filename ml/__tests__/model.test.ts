import { describe, expect, it } from 'vitest';
import { loadTemplates } from '../data';
import { buildFrameVocab, frameVector } from '../feedback';
import { auc } from '../metrics';
import { blend, learnedWeight, loadModel, predictProba, scoreLearned, serializeModel, trainModel } from '../model';
import { simulate } from '../simulate';
import { examplesFor, splitUsers } from '../train';

const templates = loadTemplates();

describe('simulation', () => {
  it('est déterministe pour une graine donnée', () => {
    const a = simulate(templates, { users: 20, perUser: 10, seed: 7 });
    const b = simulate(templates, { users: 20, perUser: 10, seed: 7 });
    const c = simulate(templates, { users: 20, perUser: 10, seed: 8 });
    expect(b.ratings).toEqual(a.ratings);
    expect(b.events).toEqual(a.events);
    expect(c.ratings).not.toEqual(a.ratings);
  });
  it('produit des visages variés et des avis des deux sortes', () => {
    const s = simulate(templates, { users: 80, perUser: 15, seed: 3 });
    expect(new Set(s.users.map((u) => u.metrics.shape)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(s.users.map((u) => u.metrics.skin.undertone)).size).toBe(3);
    const likes = s.ratings.filter((r) => r.like).length / s.ratings.length;
    expect(likes).toBeGreaterThan(0.25);
    expect(likes).toBeLessThan(0.75);
    expect(new Set(s.ratings.filter((r) => r.user === 0).map((r) => r.templateId)).size).toBe(15);
  });
});

describe('modèle appris', () => {
  const vocab = buildFrameVocab(templates);
  const sim = simulate(templates, { users: 300, perUser: 20, seed: 11 });
  const split = splitUsers(300, 12, [0.8, 0]);
  const tr = examplesFor(sim, templates, split.train, vocab);
  const te = examplesFor(sim, templates, split.test, vocab);
  const model = trainModel(tr.examples, { vocab, epochs: 8, l2: 1e-3, seed: 1, source: 'simulated', nFeedback: 0 });

  it('bat le hasard sur des utilisateurs jamais vus', () => {
    const p = te.examples.map((e) => predictProba(model, e.face, e.frame));
    expect(auc(p, te.ratings.map((r) => r.like))).toBeGreaterThan(0.7);
  });
  it('donne un score 0–100 et survit à la sérialisation', () => {
    const json = serializeModel(model);
    expect(json.length).toBeLessThan(50 * 1024);
    const loaded = loadModel(JSON.parse(json));
    const face = sim.users[0].face;
    const frame = frameVector(templates[0], loaded.frame.vocab);
    const s = scoreLearned(face, frame, loaded);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
    expect(Math.abs(s - scoreLearned(face, frame, model))).toBeLessThanOrEqual(1);
    // a face without fine features still gets a score
    const partial = { ...face, v: face.v.map((x, i) => (i >= 9 ? null : x)) };
    expect(Number.isFinite(scoreLearned(partial, frame, loaded))).toBe(true);
  });
  it('refuse un modèle incompatible ou un vecteur monture d’une autre taille', () => {
    expect(() => loadModel({ kind: 'autre' })).toThrow();
    expect(() => loadModel({ ...model, W: model.W.slice(1) })).toThrow();
    expect(() => scoreLearned(sim.users[0].face, [1, 2, 3], model)).toThrow();
  });
});

describe('mélange règles / modèle', () => {
  it('suit les règles sans feedback réel', () => {
    expect(learnedWeight(0)).toBe(0);
    expect(blend(70, 10, 0)).toBe(70);
  });
  it('fait de plus en plus confiance au modèle, sans jamais effacer les règles', () => {
    const ws = [0, 100, 1000, 2000, 10000, 1e7].map((n) => learnedWeight(n));
    for (let i = 1; i < ws.length; i++) expect(ws[i]).toBeGreaterThan(ws[i - 1]);
    expect(learnedWeight(2000)).toBeCloseTo(0.35);
    expect(ws[ws.length - 1]).toBeLessThanOrEqual(0.7);
    expect(blend(70, 10, 1e9)).toBeGreaterThan(10);
    expect(blend(70, 10, 2000)).toBe(49);
  });
  it('reste dans 0–100 et résiste aux entrées absurdes', () => {
    expect(blend(100, 100, 5000)).toBe(100);
    expect(blend(0, 0, 5000)).toBe(0);
    expect(blend(60, 40, -5)).toBe(60);
    expect(blend(60, 40, NaN)).toBe(60);
  });
});

describe('règles sur les gabarits', () => {
  it('note chaque gabarit entre 0 et 100 et distingue les montures', async () => {
    const { ruleScore } = await import('../ruleBaseline');
    const m = simulate(templates, { users: 1, perUser: 1, seed: 5 }).users[0].metrics;
    const scores = templates.map((t) => ruleScore(m, t));
    expect(scores.every((s) => s >= 0 && s <= 100)).toBe(true);
    expect(new Set(scores).size).toBeGreaterThan(3);
  });
});
