import { describe, expect, it } from 'vitest';
import { computeMetrics, skinFromRgb, type FaceMetrics } from '../lib/faceMetrics';
import { scoreFit } from '../lib/fit';
import { specForGlasses } from '../three/frameSpec';
import { syntheticFace } from './syntheticFace';

const skin = skinFromRgb(205, 160, 135);
const face = (o: Parameters<typeof syntheticFace>[0] = {}, m: Partial<FaceMetrics> = {}) => ({
  ...computeMetrics(syntheticFace(o), skin),
  ...m,
});
const frame = (style: string, color = 'Noir') => ({ spec: specForGlasses({ style, color, material: '' }), color, price: 200 });
const has = (r: { reasons: { text: string }[] }, part: string) => r.reasons.some((x) => x.text.includes(part));

describe('traits fins', () => {
  it('lit l’épaisseur des sourcils', () => {
    expect(face({ browThick: 3 }).features!.browThickness).toBe('fine');
    expect(face({ browThick: 5.5 }).features!.browThickness).toBe('medium');
    expect(face({ browThick: 8 }).features!.browThickness).toBe('thick');
  });
  it('lit l’arc des sourcils et l’inclinaison des yeux', () => {
    expect(face({ browArch: 0 }).features!.browArch).toBe('straight');
    expect(face({ browArch: 8 }).features!.browArch).toBe('high');
    expect(face({ eyeTilt: -2 }).features!.eyeSlant).toBe('down');
    expect(face({ eyeTilt: 10 }).features!.eyeSlant).toBe('up');
  });
  it('mesure plus d’intensité sur des traits marqués', () => {
    expect(face({ browThick: 9, jaw: 118 }).features!.intensity).toBeGreaterThan(face({ browThick: 3, jaw: 96 }).features!.intensity);
  });
});

describe('règles d’expert', () => {
  it('des sourcils épais préfèrent une barre marquée à un fil de métal', () => {
    const m = face({ browThick: 8 });
    const bold = scoreFit(m, frame('Browline'));
    const wire = scoreFit(m, frame('Rond'));
    expect(bold.score).toBeGreaterThan(wire.score);
    expect(has(bold, 'sourcils épais')).toBe(true);
    expect(has(wire, 'disparaît')).toBe(true);
  });
  it('des sourcils fins refusent une monture massive', () => {
    const r = scoreFit(face({ browThick: 3 }), frame('Carré'));
    expect(has(r, 'écrase')).toBe(true);
  });
  it('un visage rond veut des angles, un visage carré des courbes', () => {
    const round = face({}, { shape: 'round' });
    expect(scoreFit(round, frame('Carré')).score).toBeGreaterThan(scoreFit(round, frame('Rond')).score);
    const square = face({}, { shape: 'square' });
    expect(scoreFit(square, frame('Rond')).score).toBeGreaterThan(scoreFit(square, frame('Carré')).score);
  });
  it('un visage en cœur évite un haut chargé', () => {
    const heart = face({}, { shape: 'heart' });
    expect(scoreFit(heart, frame('Aviateur')).score).toBeGreaterThan(scoreFit(heart, frame('Cat-eye')).score);
  });
  it('des yeux tombants gagnent à des coins relevés', () => {
    const m = face({ eyeTilt: -2 });
    expect(has(scoreFit(m, frame('Cat-eye')), 'remontent')).toBe(true);
    expect(has(scoreFit(m, frame('Rectangulaire')), 'remontent')).toBe(false);
  });
  it('suit la largeur du visage', () => {
    const narrow = face({ faceWidth: 120 });
    expect(has(scoreFit(narrow, frame('Oversize')), 'déborde')).toBe(true);
  });
  it('donne la teinte chaude à un sous-ton chaud', () => {
    const warm = face({}, { skin: { ...skin, undertone: 'chaud' } });
    expect(scoreFit(warm, frame('Rectangulaire', 'Havane')).score).toBeGreaterThan(scoreFit(warm, frame('Rectangulaire', 'Noir')).score);
  });
  it('reste utilisable sans traits fins (rapport ancien)', () => {
    const old = { ...face(), features: undefined };
    const r = scoreFit(old, frame('Rectangulaire'));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
