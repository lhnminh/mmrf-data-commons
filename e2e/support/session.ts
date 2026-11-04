import type { Page } from '@playwright/test';

const SESSION_URL = 'http://localhost:3090/sandbox/session';

/** Signs in with the sandbox's synthetic session, via the local forwarder. */
export const signIn = async (page: Page): Promise<void> => {
  const response = await page.request.get(SESSION_URL);
  if (!response.ok()) throw new Error(`Sandbox session request failed: HTTP ${response.status()}`);
  const { access_token: token } = (await response.json()) as { access_token?: string };
  if (!token) throw new Error('Sandbox session response had no access_token');
  await page.context().addCookies([
    { name: 'credentials_token', value: token, domain: 'localhost', path: '/' },
  ]);
};
