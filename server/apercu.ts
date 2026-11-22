/**
 * « Me voir avec » : photo réaliste de la personne portant une monture, générée par
 * Gemini (Nano Banana 2) à partir de sa photo d'analyse et de l'image de référence
 * de la monture.
 *
 * Sécurité : la clé reste côté serveur et le client ne choisit que l'identifiant de
 * la monture ; l'image de référence vient de nos propres fichiers (/references/<id>.jpg),
 * jamais d'une URL fournie par le client. Aucune image n'est conservée.
 *
 * Variables d'environnement :
 *   GEMINI_API_KEY        clé de l'API Gemini (obligatoire en production)
 *   GEMINI_IMAGE_MODEL    défaut : gemini-3.1-flash-image (Nano Banana 2)
 *   APERCU_DEMO=1         sans clé : renvoie la photo telle quelle (tests d'interface)
 *   APERCU_MAX_PAR_HEURE  limite par adresse IP, défaut 6
 */

export interface ApercuRequest {
  /** photo du visage, data URL JPEG/PNG */
  face: string;
  productId: number;
  /** pour aider le modèle à respecter les proportions */
  frameWidthMm?: number;
  faceWidthMm?: number;
}

export type Env = Record<string, string | undefined>;

const MAX_FACE_BYTES = 2_500_000;
const DEFAULT_MODEL = 'gemini-3.1-flash-image';
const FALLBACK_MODELS = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
const ENDPOINTS = ['https://generativelanguage.googleapis.com/v1beta', 'https://generativelanguage.googleapis.com/v1'];

export function buildPrompt(r: Pick<ApercuRequest, 'frameWidthMm' | 'faceWidthMm'>): string {
  const size =
    r.frameWidthMm && r.faceWidthMm
      ? ` The frame is ${Math.round(r.frameWidthMm)} mm wide and the person's face is about ${Math.round(
          r.faceWidthMm
        )} mm wide at the temples: keep that ratio.`
      : '';
  return [
    'Edit the first image, a portrait photo of a person.',
    'Make this exact person wear the glasses shown in the second image, a product photo.',
    "Keep the person's identity, face, expression, skin, hair, pose, framing, background and lighting exactly the same.",
    'Reproduce the glasses faithfully: same frame shape, thickness, colour, material, lens tint and details.',
    'Fit them naturally: resting on the bridge of the nose, temples going back over the ears, lenses centred on the eyes,',
    'realistic reflections on the lenses and soft shadows on the skin.' + size,
    'Photorealistic result. Change nothing else.',
  ].join(' ');
}

/** Prompt when the frame is described by its real reference instead of an image. */
export function buildNamedPrompt(frame: { name: string; look: string }, r: Pick<ApercuRequest, 'frameWidthMm' | 'faceWidthMm'>): string {
  const size =
    r.frameWidthMm && r.faceWidthMm
      ? ` The frame is about ${Math.round(r.frameWidthMm)} mm wide and the face about ${Math.round(r.faceWidthMm)} mm: keep that ratio.`
      : '';
  return [
    'Edit this portrait photo of a person.',
    `Make this exact person wear a pair of ${frame.name} glasses (${frame.look}), exactly as the real product looks in its official product photos.`,
    "Keep the person's identity, face, expression, skin, hair, pose, framing, background and lighting exactly the same.",
    'Fit the glasses naturally: resting on the bridge of the nose, temples going back over the ears, lenses centred on the eyes,',
    'realistic reflections on the lenses and soft shadows on the skin.' + size,
    'Photorealistic result. Change nothing else.',
  ].join(' ');
}

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

export function buildGeminiBody(face: { mimeType: string; data: string }, frame: { mimeType: string; data: string } | null, prompt: string) {
  const parts: Record<string, unknown>[] = [{ text: prompt }, { inlineData: face }];
  if (frame) parts.push({ inlineData: frame });
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE'] },
  };
}

/** Extracts the first image from a Gemini response (camelCase or snake_case). */
export function extractImage(json: unknown): { mimeType: string; data: string } | null {
  const parts = (json as { candidates?: { content?: { parts?: Record<string, unknown>[] } }[] })?.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const d = (p.inlineData ?? p.inline_data) as { mimeType?: string; mime_type?: string; data?: string } | undefined;
    if (d?.data) return { mimeType: d.mimeType ?? d.mime_type ?? 'image/png', data: d.data };
  }
  return null;
}

// ---- best-effort rate limit (per server instance) ----
const hits = new Map<string, number[]>();
export function allow(ip: string, maxPerHour: number, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= maxPerHour) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * Reference image of a frame, chosen by us: the merchant photo for feed products (listed in
 * /references/index.json by `npm run flux`), our own front render otherwise.
 * Never a URL sent by the client.
 */
export async function referenceUrl(productId: number, origin: string): Promise<string> {
  try {
    const res = await fetch(new URL('/references/index.json', origin));
    if (res.ok) {
      const index = (await res.json()) as Record<string, string>;
      if (index[productId]) return index[productId];
    }
  } catch {
    /* no index: own renders only */
  }
  return `/references/${productId}.jpg`;
}

/** Catalogue frames described by their real reference (public/references/catalogue.json). */
export async function namedFrame(productId: number, origin: string): Promise<{ name: string; look: string } | null> {
  try {
    const res = await fetch(new URL('/references/catalogue.json', origin));
    if (!res.ok) return null;
    const all = (await res.json()) as Record<string, { name: string; look: string }>;
    return all[productId] ?? null;
  } catch {
    return null;
  }
}

async function hasFeedPhoto(productId: number, origin: string): Promise<boolean> {
  return (await referenceUrl(productId, origin)) !== `/references/${productId}.jpg`;
}

async function fetchReference(origin: string, productId: number) {
  const res = await fetch(new URL(await referenceUrl(productId, origin), origin));
  if (!res.ok) return null;
  const type = res.headers.get('content-type') ?? 'image/jpeg';
  if (!/^image\/(jpeg|png|webp)/.test(type)) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType: type.split(';')[0], data: buf.toString('base64') };
}

export async function handleApercu(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });

  let body: ApercuRequest;
  try {
    body = (await request.json()) as ApercuRequest;
  } catch {
    return json(400, { error: 'Requête illisible.' });
  }
  const face = typeof body.face === 'string' ? parseDataUrl(body.face) : null;
  if (!face) return json(400, { error: 'Photo manquante ou format non pris en charge.' });
  if (face.data.length * 0.75 > MAX_FACE_BYTES) return json(413, { error: 'Photo trop lourde.' });
  if (!Number.isInteger(body.productId) || body.productId < 0) return json(400, { error: 'Monture inconnue.' });

  const ip = (request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  if (!allow(ip, Number(env.APERCU_MAX_PAR_HEURE ?? 6))) {
    return json(429, { error: 'Tu as atteint la limite d’aperçus pour l’instant. Réessaie dans une heure.' });
  }

  // Priority: merchant photo of the exact product > real reference by name > our own render.
  const origin = new URL(request.url).origin;
  const named = (await hasFeedPhoto(body.productId, origin)) ? null : await namedFrame(body.productId, origin);
  const frame = named ? null : await fetchReference(origin, body.productId);
  if (!named && !frame) return json(404, { error: 'Monture inconnue.' });

  const key = env.GEMINI_API_KEY;
  if (!key) {
    if (env.APERCU_DEMO === '1') return json(200, { image: body.face, demo: true });
    return json(503, { error: 'L’aperçu par IA n’est pas encore activé sur ce site.' });
  }

  // Model names differ between accounts and API versions (e.g. a "-preview" suffix):
  // try the configured one first, then the known aliases.
  const models = [...new Set([env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS])];
  const prompt = named ? buildNamedPrompt(named, body) : buildPrompt(body);
  const payload = JSON.stringify(buildGeminiBody(face, frame, prompt));
  const tried: string[] = [];
  for (const model of models) {
    for (const base of ENDPOINTS) {
      const res = await fetch(`${base}/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: payload,
      });
      const out = await res.json().catch(() => null);
      if (!res.ok) {
        const err = describeGeminiError(res.status, out);
        console.error('Gemini error', model, base, res.status, JSON.stringify(out).slice(0, 800));
        if (err.modelMissing) {
          tried.push(`${model} (${base.endsWith('v1') ? 'v1' : 'v1beta'})`);
          continue;
        }
        return json(502, { error: err.message, detail: err.detail });
      }
      const img = extractImage(out);
      if (!img) {
        const reason = noImageReason(out);
        console.error('Gemini returned no image', model, JSON.stringify(out).slice(0, 800));
        return json(502, { error: reason.message, detail: reason.detail });
      }
      return json(200, { image: `data:${img.mimeType};base64,${img.data}`, model });
    }
  }
  return json(502, {
    error: 'Aucun modèle de génération d’images n’est disponible pour cette clé.',
    detail: `Modèles essayés : ${tried.join(', ')}. Définis GEMINI_IMAGE_MODEL dans Vercel avec un modèle disponible sur ton compte.`,
  });
}

/** Turns a Gemini error into a message the site owner can act on (never contains the key). */
export function describeGeminiError(status: number, out: unknown): { message: string; detail: string; modelMissing: boolean } {
  const e = (out as { error?: { message?: string; status?: string; details?: { reason?: string }[] } })?.error ?? {};
  const msg = e.message ?? '';
  const code = e.status ?? '';
  const reason = e.details?.find((d) => d.reason)?.reason ?? '';
  const detail = `Gemini ${status}${code ? ' ' + code : ''}${reason ? ' (' + reason + ')' : ''}: ${msg}`.slice(0, 400);
  const modelMissing =
    status === 404 || (status === 400 && /not found|is not supported|unknown model|not available/i.test(msg) && !/api key/i.test(msg));
  let message = 'Le service de génération a refusé la demande.';
  if (reason === 'API_KEY_INVALID' || /api key not valid/i.test(msg)) message = 'La clé Gemini est invalide : vérifie GEMINI_API_KEY dans Vercel.';
  else if (status === 429) message = 'Quota Gemini atteint, ou génération d’images non incluse dans l’offre gratuite : active la facturation sur le projet Google.';
  else if (status === 403) message = 'Google refuse l’accès : vérifie que l’API Gemini est activée et que la facturation est configurée sur le projet de la clé.';
  else if (status >= 500) message = 'Le service de Google est momentanément indisponible. Réessaie dans un instant.';
  else if (/location|region|country/i.test(msg)) message = 'Ce modèle n’est pas disponible dans la région du serveur.';
  return { message, detail, modelMissing };
}

export function noImageReason(out: unknown): { message: string; detail: string } {
  const o = out as { promptFeedback?: { blockReason?: string }; candidates?: { finishReason?: string }[] };
  const why = o?.promptFeedback?.blockReason ?? o?.candidates?.[0]?.finishReason ?? 'inconnue';
  const blocked = /SAFETY|BLOCK|PROHIBITED|RECITATION|IMAGE_OTHER/i.test(why);
  return {
    message: blocked
      ? 'L’IA a refusé de modifier cette photo (filtre de sécurité). Essaie avec une autre photo de face, bien éclairée.'
      : 'Aucune image n’a été générée. Réessaie.',
    detail: `Raison : ${why}`,
  };
}
