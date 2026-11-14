// Verifica se a requisição vem do administrador logado (Google) usando o ID token do Firebase.
// A chave abaixo é a "Web API key" do Firebase:她 é pública por natureza (já vai no site), não é segredo.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'brfariarm@gmail.com').toLowerCase();
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAZrON71VrOd-q2tQ4nnRm9OkViFnJtQ28';

export async function verifyAdmin(req: any): Promise<boolean> {
  const header = String(req?.headers?.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  try {
    const r = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: match[1] })
      }
    );
    if (!r.ok) return false;
    const data: any = await r.json();
    const user = data?.users?.[0];
    return !!user && String(user.email || '').toLowerCase() === ADMIN_EMAIL && user.emailVerified === true;
  } catch {
    return false;
  }
}

// Confere o segredo do webhook (?secret=... ou header x-webhook-secret). Se WEBHOOK_SECRET não estiver definido, libera (modo antigo).
export function webhookSecretOk(req: any): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return true;
  const fromQuery = String(req?.query?.secret || '');
  const fromHeader = String(req?.headers?.['x-webhook-secret'] || '');
  return fromQuery === expected || fromHeader === expected;
}
