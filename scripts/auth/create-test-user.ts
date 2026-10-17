import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

interface Options {
  email: string;
  password: string;
  displayName?: string;
}

function parseOptions(args: string[]): Options {
  let email: string | undefined;
  let displayName: string | undefined;
  for (const arg of args) {
    if (arg.startsWith('--email=') && email === undefined) {
      email = arg.slice('--email='.length).trim();
    } else if (arg.startsWith('--display-name=') && displayName === undefined) {
      displayName = arg.slice('--display-name='.length).trim();
    } else {
      throw new Error('Use optional --email= and --display-name= arguments once each.');
    }
  }

  email ??= `trashmovies-test+${Date.now()}-${randomBytes(4).toString('hex')}@example.com`;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid test-user email.');
  }
  if (displayName !== undefined && (displayName.length < 1 || displayName.length > 60 || /[\u0000-\u001f\u007f]/.test(displayName))) {
    throw new Error('Display name must be 1–60 characters without control characters.');
  }
  const password = process.env.TEST_USER_PASSWORD;
  if (!password) throw new Error('TEST_USER_PASSWORD is required in the local environment.');
  return { email, password, ...(displayName === undefined ? {} : { displayName }) };
}

function adminConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const ref = process.env.SUPABASE_EXPECTED_PROJECT_REF?.trim();
  if (!url || !key || !ref || !/^[a-z0-9]+$/.test(ref)) {
    throw new Error('Admin Supabase configuration is incomplete.');
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid Supabase URL.'); }
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== `${ref}.supabase.co`
    || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Supabase URL does not match the expected project.');
  }
  if (key.startsWith('sb_publishable_')) throw new Error('A public key cannot be used for this script.');
  const jwtParts = key.split('.');
  if (jwtParts.length === 3) {
    try {
      const payload: unknown = JSON.parse(Buffer.from(jwtParts[1], 'base64url').toString('utf8'));
      if (typeof payload === 'object' && payload !== null && 'role' in payload
        && (payload.role === 'anon' || payload.role === 'authenticated')) {
        throw new Error('A public key cannot be used for this script.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('public key')) throw error;
    }
  }
  return { url, key };
}

async function main(): Promise<void> {
  const { email, password, displayName } = parseOptions(process.argv.slice(2));
  const { url, key } = adminConfig();
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...(displayName === undefined ? {} : { user_metadata: { display_name: displayName } }),
  });
  if (error || !data.user) throw new Error('Admin API could not create the test user.');

  console.log(`User ID: ${data.user.id}`);
  console.log(`Email: ${data.user.email ?? email}`);
  console.log(`Confirmed: ${data.user.email_confirmed_at ? 'yes' : 'no'}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Test-user creation failed.');
  process.exitCode = 1;
});
