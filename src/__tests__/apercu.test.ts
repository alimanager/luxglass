import { afterEach, describe, expect, it, vi } from 'vitest';
import { allow, buildGeminiBody, describeGeminiError, noImageReason, buildPrompt, extractImage, handleApercu, parseDataUrl, referenceUrl } from '../../server/apercu';

const FACE = 'data:image/jpeg;base64,' + Buffer.from('face').toString('base64');

const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('https://luxoptic.test/api/apercu', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

afterEach(() => vi.unstubAllGlobals());

describe('construction de la requête Gemini', () => {
  it('envoie le texte, le visage puis la monture, et ne demande qu’une image', () => {
    const body = buildGeminiBody({ mimeType: 'image/jpeg', data: 'A' }, { mimeType: 'image/jpeg', data: 'B' }, 'p');
    expect(body.contents[0].parts.map((p) => Object.keys(p)[0])).toEqual(['text', 'inlineData', 'inlineData']);
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE']);
  });

  it('donne les proportions réelles au modèle', () => {
    expect(buildPrompt({ frameWidthMm: 138, faceWidthMm: 134 })).toContain('138 mm');
  });

  it('lit l’image de la réponse, en camelCase comme en snake_case', () => {
    expect(extractImage({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: 'X' } }] } }] })).toEqual({
      mimeType: 'image/png',
      data: 'X',
    });
    expect(extractImage({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: 'Y' } }] } }] })?.data).toBe('Y');
    expect(extractImage({})).toBeNull();
  });

  it('refuse les data URL qui ne sont pas des images', () => {
    expect(parseDataUrl('data:text/html;base64,PGI+')).toBeNull();
    expect(parseDataUrl(FACE)?.mimeType).toBe('image/jpeg');
  });
});

describe('sécurité du point d’accès', () => {
  it('choisit lui-même l’image de la monture (jamais une URL du client)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ '1001': 'https://cdn.marchand.test/p.jpg' })));
    expect(await referenceUrl(1001, 'https://luxoptic.test')).toBe('https://cdn.marchand.test/p.jpg');
    expect(await referenceUrl(5, 'https://luxoptic.test')).toBe('/references/5.jpg');
  });

  it('limite le nombre d’aperçus par adresse', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow('9.9.9.9', 3, now)).toBe(true);
    expect(allow('9.9.9.9', 3, now)).toBe(false);
    expect(allow('9.9.9.9', 3, now + 3_600_001)).toBe(true);
  });

  it('répond 503 tant que la clé n’est pas configurée', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from('img'), { headers: { 'content-type': 'image/jpeg' } })));
    const res = await handleApercu(post({ face: FACE, productId: 1 }, '10.0.0.1'), {});
    expect(res.status).toBe(503);
  });

  it('rejette une photo absente', async () => {
    const res = await handleApercu(post({ productId: 1 }, '10.0.0.2'), {});
    expect(res.status).toBe(400);
  });
});

describe('aller-retour avec Gemini (simulé)', () => {
  it('renvoie l’image générée', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        calls.push(String(url));
        if (String(url).endsWith('index.json')) return new Response('', { status: 404 });
        if (String(url).includes('/references/')) return new Response(Buffer.from('ref'), { headers: { 'content-type': 'image/jpeg' } });
        const sent = JSON.parse(String(init?.body));
        expect(sent.contents[0].parts).toHaveLength(3);
        expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
        return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'R0VO' } }] } }] });
      })
    );
    const res = await handleApercu(post({ face: FACE, productId: 2, frameWidthMm: 140, faceWidthMm: 136 }, '10.0.0.3'), {
      GEMINI_API_KEY: 'k',
      NODE_ENV: 'production',
    });
    expect(res.status).toBe(200);
    expect((await res.json()).image).toBe('data:image/png;base64,R0VO');
    expect(calls[1]).toBe('https://luxoptic.test/references/2.jpg');
    expect(calls[2]).toContain('/models/gemini-3.1-flash-image:generateContent');
  });
});

describe('erreurs de Gemini', () => {
  it('passe au modèle suivant quand le nom n’existe pas', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const u = String(url);
        urls.push(u);
        if (u.endsWith('index.json')) return new Response('', { status: 404 });
        if (u.includes('/references/')) return new Response(Buffer.from('ref'), { headers: { 'content-type': 'image/jpeg' } });
        if (u.includes('gemini-3.1-flash-image-preview') && u.includes('v1beta'))
          return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'T0s=' } }] } }] });
        return Response.json({ error: { code: 404, message: 'models/x is not found', status: 'NOT_FOUND' } }, { status: 404 });
      })
    );
    const res = await handleApercu(post({ face: FACE, productId: 1 }, '10.0.1.1'), { GEMINI_API_KEY: 'k' });
    expect(res.status).toBe(200);
    expect((await res.json()).model).toBe('gemini-3.1-flash-image-preview');
  });

  it.each([
    [429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'quota' } }, /facturation/],
    [400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } }, /clé Gemini est invalide/],
    [403, { error: { status: 'PERMISSION_DENIED', message: 'denied' } }, /API Gemini est activée/],
  ])('explique l’erreur %i', (status, out, re) => {
    const e = describeGeminiError(status, out);
    expect(e.message).toMatch(re);
    expect(e.modelMissing).toBe(false);
    expect(e.detail).toContain(String(status));
  });

  it('explique un refus par filtre de sécurité', () => {
    expect(noImageReason({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] }).message).toMatch(/filtre de sécurité/);
  });
});
