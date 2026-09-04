// Transactional email via Resend.
import type { Env } from '../types';

/** Send a magic-link sign-in email via Resend. Injectable, so tests mock it. */
export async function sendMagicLinkEmail(env: Env, to: string, link: string): Promise<void> {
  const key = env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Organizard <login@organizard.app>',
      to,
      subject: 'Your Organizard sign-in link',
      html:
        `<p>Tap to sign in to Organizard:</p>` +
        `<p><a href="${link}">Sign in</a></p>` +
        `<p>This link expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
}
