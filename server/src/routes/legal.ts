// Public, unauthenticated pages: Privacy Policy + Support.
// Required by the App Store (every listing needs a privacy policy URL and a
// support URL). Served as self-contained, mobile-friendly HTML from the Worker
// we already run, so there's no extra hosting to manage.
//
// EFFECTIVE_DATE / CONTACT_EMAIL are the two things to keep current.
import { Hono } from 'hono';

const EFFECTIVE_DATE = 'June 9, 2026';
const CONTACT_EMAIL = 'aaditya.kv@gmail.com';

// Tuck sloth mark (same art as the app icon / in-app logo).
const SLOTH = `
<svg viewBox="0 0 120 120" width="64" height="64" aria-hidden="true" style="display:block;margin:0 auto 12px">
  <g fill="#A77E54">
    <path d="M39 66 c-2 -7 4 -10 9.5 -8 c4.5 1.6 5.5 6.5 2 9.8 c-3.4 3.2 -9.5 3 -11.5 -1.8 Z"/>
    <path d="M81 66 c2 -7 -4 -10 -9.5 -8 c-4.5 1.6 -5.5 6.5 -2 9.8 c3.4 3.2 9.5 3 11.5 -1.8 Z"/>
  </g>
  <ellipse cx="60" cy="41" rx="20.5" ry="19" fill="#A77E54"/>
  <ellipse cx="60" cy="44" rx="15.5" ry="14.5" fill="#F0E0C6"/>
  <ellipse cx="51.5" cy="42" rx="5.4" ry="8" fill="#6E4A30" transform="rotate(20 51.5 42)"/>
  <ellipse cx="68.5" cy="42" rx="5.4" ry="8" fill="#6E4A30" transform="rotate(-20 68.5 42)"/>
  <circle cx="52" cy="43" r="2.5" fill="#2A2722"/><circle cx="68" cy="43" r="2.5" fill="#2A2722"/>
  <ellipse cx="60" cy="49.5" rx="2.8" ry="2.1" fill="#2A2722"/>
  <path d="M55.5 53.5 q4.5 3.4 9 0" fill="none" stroke="#7A5636" stroke-width="1.9" stroke-linecap="round"/>
  <rect x="24" y="63" width="72" height="42" rx="11" fill="#4CAF7D"/>
  <path d="M25 64 L57 64 L50.5 49.5 L18 49.5 Z" fill="#62BC8C"/>
  <path d="M95 64 L63 64 L69.5 49.5 L102 49.5 Z" fill="#3C9669"/>
  <rect x="55" y="63" width="10" height="42" fill="#E0F1E7" opacity="0.9"/>
</svg>`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="index" />
<title>${title} · Tuck</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #F7F6F2; color: #2A2722;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; font-size: 17px;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 40px 22px 80px; }
  header { text-align: center; margin-bottom: 28px; }
  header .name { font-size: 26px; font-weight: 800; letter-spacing: -0.01em; }
  header .tag { color: #6F6A5E; font-size: 15px; margin-top: 2px; }
  h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.01em; margin: 8px 0 4px; }
  h2 { font-size: 19px; font-weight: 700; margin: 30px 0 8px; }
  .updated { color: #918B7C; font-size: 14px; margin-bottom: 8px; }
  p, li { color: #4C473E; }
  a { color: #2E7A54; }
  ul { padding-left: 22px; }
  li { margin: 5px 0; }
  .tldr {
    background: #EAF6EF; border: 1px solid #CFEBDB; border-radius: 14px;
    padding: 16px 18px; margin: 18px 0 4px;
  }
  .tldr strong { color: #245F42; }
  .card {
    background: #fff; border: 1px solid #E4E1D7; border-radius: 14px;
    padding: 4px 20px 16px; margin-top: 18px;
  }
  footer { margin-top: 44px; color: #918B7C; font-size: 14px; text-align: center; }
  footer a { color: #6F6A5E; }
  code { background: #EFEDE5; padding: 1px 6px; border-radius: 6px; font-size: 14px; }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      ${SLOTH}
      <div class="name">Tuck</div>
      <div class="tag">Pack fast. Find anything. Share the load.</div>
    </header>
    ${body}
    <footer>
      <a href="/privacy">Privacy</a> · <a href="/support">Support</a><br/>
      © 2026 Tuck
    </footer>
  </div>
</body>
</html>`;
}

const privacyBody = `
  <h1>Privacy Policy</h1>
  <div class="updated">Last updated: ${EFFECTIVE_DATE}</div>

  <div class="tldr">
    <strong>The short version.</strong> Tuck is built local-first. Everything you
    add to a move lives on your device and never leaves it &mdash; <em>unless</em> you
    choose to <strong>share</strong> that move, which copies it to our servers so the
    people you invite can see it. We don't run ads, we don't use third-party
    analytics or trackers, and we never sell your data.
  </div>

  <div class="card">
  <h2>What Tuck is</h2>
  <p>Tuck helps you organize a physical move: you create a move, add rooms, pack
  boxes, and list the items inside them (with quantities, estimated values, notes,
  and photos). Each box gets a scannable QR label so you can find things fast.</p>

  <h2>Data that stays on your device</h2>
  <p>By default, a move is <strong>local-only</strong>. The move, its rooms, boxes,
  items, notes, estimated values, and the photos you take are stored only on your
  device. We can't see them, and they aren't sent to us or anyone else. Deleting the
  app removes this local data.</p>

  <h2>Data we receive when you share a move</h2>
  <p>Sharing is optional. When you share a move so others can collaborate, that
  move is copied to our servers so invited people can open it. What's included:</p>
  <ul>
    <li><strong>The move's contents</strong> &mdash; room, box, and item names;
      quantities; estimated values; notes; markers; and the move's <em>from</em> /
      <em>to</em> addresses and target date, if you added them.</li>
    <li><strong>Photos</strong> attached to boxes or items in that move.</li>
    <li><strong>Collaboration info</strong> &mdash; who has access and their role
      (owner, editor, or viewer).</li>
  </ul>
  <p>Moves you keep local are never included.</p>

  <h2>Your account (Sign in with Apple)</h2>
  <p>Sharing requires an account, which you create with <strong>Sign in with
  Apple</strong>. We receive a unique Apple identifier and, if you allow it, your
  email and name &mdash; used only to identify your account and let collaborators
  know who you are. You can use Apple's <em>Hide My Email</em> to share a private
  relay address instead of your real one.</p>

  <h2>Camera and photos</h2>
  <p>Tuck uses the camera, with your permission, to photograph items and to scan a
  box's QR label. Photos stay on your device for local moves, and are uploaded to
  our storage only for moves you've shared.</p>

  <h2>Location</h2>
  <p>If you grant location access, Tuck uses your approximate location
  <strong>only while you're using the app</strong> to suggest your move's from/to
  addresses as you type. We don't track your location in the background, and we
  don't store your coordinates &mdash; only the address text you choose to save.</p>

  <h2>What we don't do</h2>
  <ul>
    <li>No advertising and no ad networks.</li>
    <li>No third-party analytics or tracking SDKs, and no tracking you across other
      apps or websites.</li>
    <li>We never sell or rent your personal data.</li>
  </ul>

  <h2>Where data is stored</h2>
  <p>Shared-move data is hosted on <strong>Cloudflare</strong> infrastructure
  (database, file storage, and session storage). Sign in with Apple is provided by
  <strong>Apple</strong>. These providers process data only to run the service.</p>

  <h2>Keeping and deleting your data</h2>
  <p>Local data lives on your device until you delete the move or the app.
  Shared-move data remains on our servers until the move's <strong>owner deletes
  the move</strong>, which removes it and its photos. To delete your account or
  request removal of data associated with you, email us at
  <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> and we'll take care of it.</p>

  <h2>Children</h2>
  <p>Tuck isn't directed at children and isn't intended for use by children under 13.</p>

  <h2>Changes</h2>
  <p>If we change this policy, we'll update the date above and post the new version
  here.</p>

  <h2>Contact</h2>
  <p>Questions about privacy? Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
  </div>
`;

const supportBody = `
  <h1>Support</h1>
  <div class="updated">We're happy to help.</div>

  <div class="card">
  <h2>Get in touch</h2>
  <p>Email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> with any question,
  bug, or idea &mdash; we read every message and usually reply within a couple of
  days. Telling us your device and iOS version helps us help you faster.</p>

  <h2>Common questions</h2>

  <p><strong>What is Tuck?</strong><br/>
  An app for organizing a physical move. Create a move, add rooms, pack boxes, and
  list what's inside &mdash; then scan a box's QR label to jump straight to its
  contents. The point is to make &ldquo;which box is my <em>X</em> in?&rdquo;
  answerable during a stressful move.</p>

  <p><strong>Does it cost anything?</strong><br/>
  No. Tuck is free, and every move works fully offline on your device.</p>

  <p><strong>How do the QR labels work?</strong><br/>
  Each box gets a unique QR code. Print the labels from inside the app, stick one on
  each box, and scan it later to open that box's contents instantly.</p>

  <p><strong>How does sharing a move work?</strong><br/>
  Sharing is optional. When you share a move, it's copied to our servers so the
  people you invite (as editor or viewer) can collaborate. Moves you don't share
  stay entirely on your device.</p>

  <p><strong>How do I delete my data?</strong><br/>
  Deleting a local move or deleting the app removes its data from your device. For a
  shared move, the move's owner can delete it to remove it from our servers. To
  delete your account or any data associated with you, just email us.</p>

  <h2>Privacy</h2>
  <p>See our <a href="/privacy">Privacy Policy</a> for how Tuck handles your data.</p>
  </div>
`;

export function legalRoutes() {
  const r = new Hono();
  r.get('/privacy', (c) => c.html(page('Privacy Policy', privacyBody)));
  r.get('/support', (c) => c.html(page('Support', supportBody)));
  return r;
}
