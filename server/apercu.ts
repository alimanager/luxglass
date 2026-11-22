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

export function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { mimeType: m[1], data: m[2] } : null;
}

export function buildGeminiBody(face: { mimeType: string; data: string }, frame: { mimeType: string; data: string }, prompt: string) {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, { inlineData: face }, { inlineData: frame }],
      },
    ],
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

  const frame = await fetchReference(new URL(request.url).origin, body.productId);
  if (!frame) return json(404, { error: 'Monture inconnue.' });

  const key = env.GEMINI_API_KEY;
  if (!key) {
    if (env.APERCU_DEMO === '1') return json(200, { image: body.face, demo: true });
    return json(503, { error: 'L’aperçu par IA n’est pas encore activé sur ce site.' });
  }

  const model = env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
  const payload = JSON.stringify(buildGeminiBody(face, frame, buildPrompt(body)));
  let lastError = '';
  for (const base of ENDPOINTS) {
    const res = await fetch(`${base}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: payload,
    });
    if (res.status === 404) {
      lastError = `modèle ${model} introuvable sur ${base}`;
      continue;
    }
    const out = await res.json().catch(() => null);
    if (!res.ok) {
      console.error('Gemini error', res.status, JSON.stringify(out).slice(0, 500));
      return json(502, { error: 'Le service de génération a refusé la demande. Réessaie avec une autre photo.' });
    }
    const img = extractImage(out);
    if (!img) {
      console.error('Gemini returned no image', JSON.stringify(out).slice(0, 500));
      return json(502, { error: 'Aucune image n’a été générée. Réessaie.' });
    }
    return json(200, { image: `data:${img.mimeType};base64,${img.data}` });
  }
  console.error('Gemini', lastError);
  return json(502, { error: 'Le service de génération est indisponible.' });
}
