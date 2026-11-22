// Vercel Function: POST /api/apercu (logic in server/apercu.ts)
import { handleApercu } from '../server/apercu.js';

export const maxDuration = 60;

export function POST(request: Request): Promise<Response> {
  return handleApercu(request, process.env);
}
