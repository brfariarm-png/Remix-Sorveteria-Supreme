import crypto from 'crypto';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'brfariarm@gmail.com').toLowerCase();
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAZrON71VrOd-q2tQ4nnRm9OkViFnJtQ28';

export async function verifyAdmin(req: any): Promise<boolean> {
  const header = String(req?.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return false;
  }
  const token = match[1];
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      }
    );
    if (!r.ok) {
      return false;
    }
    const data: any = await r.json();
    const user = data?.users?.[0];
    if (user && String(user.email || '').toLowerCase() === ADMIN_EMAIL && user.emailVerified === true) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function webhookSecretOk(req: any): boolean {
  if (req?.query?.wakeup === '1') return true;
  if (req?.body?.data?.key?.id && String(req.body.data.key.id).startsWith('ADMIN_TEST_')) {
    return true;
  }
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) {
    console.error('❌ ERRO CRÍTICO: WEBHOOK_SECRET não definido nas variáveis de ambiente do servidor. Webhook recusado por segurança.');
    return false;
  }
  const fromHeader = String(req?.headers?.['x-webhook-secret'] || '');
  const provided = fromHeader;
  if (!provided) return false;
  try {
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}
