# Trusted HTTPS Tunnel Testing for Phone Camera and QR Scanning

Use this guide when you need to open the local Carto Next.js app on an iPhone over HTTPS. The recommended workflow is a real HTTPS tunnel such as ngrok or Cloudflare Tunnel, not a local self-signed certificate.

## Project Facts

- The local dev command is `npm run dev`.
- `npm run dev` runs `next dev`, which serves the app on `http://localhost:3000` by default.
- `npm run dev:lan` runs `next dev -H 0.0.0.0 -p 3000` if direct LAN HTTP testing is needed for non-camera pages.
- The app uses NextAuth through `app/api/auth/[...nextauth]/route.ts` and `lib/auth-config.ts`.
- Next.js loads local environment variables from `.env` / `.env.local` files automatically.
- For tunnel testing, `NEXTAUTH_URL` must temporarily match the public HTTPS tunnel URL.

Do not commit real `.env` files or production secrets. Keep tunnel-specific values local only.

## Why HTTPS Is Needed

Mobile browsers require a secure context before allowing camera access through `getUserMedia`. `https://` pages are secure contexts. `http://localhost` is also treated specially, but only on the same device.

When an iPhone opens `https://192.168.x.x:3000`, Safari sees a certificate that is invalid for that IP address or self-signed by a local development CA it does not trust. Safari then shows "This Connection Is Not Private", and camera access is blocked or unreliable. Do not force Safari through that warning for QR scanner testing.

A tunnel gives the phone a trusted public `https://` URL that forwards traffic to your local Next.js server at `http://localhost:3000`.

## Option A: ngrok

Use ngrok first if it is installed and configured.

### 1. Check or Install ngrok

Check whether ngrok is available:

```powershell
ngrok version
```

If the command is not found, install ngrok from the official ngrok download page or with your preferred package manager. If your ngrok install requires authentication, run the auth-token setup command from your ngrok dashboard before starting the tunnel.

### 2. Start Next.js

In terminal 1:

```powershell
npm run dev
```

Confirm the app is running locally at:

```text
http://localhost:3000
```

### 3. Start the HTTPS Tunnel

In terminal 2:

```powershell
npx ngrok http 3000
```

Copy the generated HTTPS forwarding URL. It will look similar to:

```text
https://your-ngrok-url.ngrok-free.app
```

Do not hardcode this in the repo. Free tunnel URLs often change every time the tunnel restarts unless you use a reserved ngrok domain.

### 4. Update Local NextAuth URL

In your local `.env` file, temporarily set:

```env
NEXTAUTH_URL="https://your-ngrok-url"
```

Replace `https://your-ngrok-url` with the exact HTTPS forwarding URL from ngrok. Do not add a trailing slash.

After changing `NEXTAUTH_URL`, stop and restart the Next.js dev server:

```powershell
npm run dev
```

Then open the same HTTPS ngrok URL on your iPhone in Safari.

## Option B: Cloudflare Tunnel

Use Cloudflare Tunnel if ngrok is not installed, not configured, or not working for this machine.

### 1. Check or Install cloudflared

Check whether cloudflared is available:

```powershell
cloudflared --version
```

If the command is not found, install `cloudflared` from the official Cloudflare Tunnel download page or with your preferred package manager.

### 2. Start Next.js

In terminal 1:

```powershell
npm run dev
```

Confirm the app is running locally at:

```text
http://localhost:3000
```

### 3. Start the HTTPS Tunnel

In terminal 2:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Copy the generated `trycloudflare.com` HTTPS URL. It will look similar to:

```text
https://your-cloudflare-url.trycloudflare.com
```

Do not hardcode this in the repo. Temporary Cloudflare Tunnel URLs can change when the tunnel restarts.

### 4. Update Local NextAuth URL

In your local `.env` file, temporarily set:

```env
NEXTAUTH_URL="https://your-cloudflare-url"
```

Replace `https://your-cloudflare-url` with the exact HTTPS URL from Cloudflare Tunnel. Do not add a trailing slash.

After changing `NEXTAUTH_URL`, stop and restart the Next.js dev server:

```powershell
npm run dev
```

Then open the same HTTPS Cloudflare Tunnel URL on your iPhone in Safari.

## Camera and QR Scanner Testing Checklist

1. Start the Next.js dev server with `npm run dev`.
2. Start either `npx ngrok http 3000` or `cloudflared tunnel --url http://localhost:3000`.
3. Copy the generated HTTPS tunnel URL.
4. Set `NEXTAUTH_URL` in your local `.env` to that exact HTTPS URL.
5. Restart the Next.js dev server after editing `.env`.
6. Open the HTTPS URL on your phone.
7. Sign in or use the intended demo account flow.
8. Open a shopping list and go to the cart scanning flow, usually `/session/start?listId=...`.
9. Allow camera permission when the browser asks.
10. Scan a Carto cart QR code.
11. Confirm the scanned cart data appears.
12. Confirm cart linking creates the active shopping session.

## Troubleshooting

### Camera Permission Denied

- Make sure you are using the `https://` tunnel URL, not `http://localhost:3000` or `http://<laptop-ip>:3000`.
- On iPhone, check Safari settings and site permissions for camera access.
- On Android, check Chrome site settings and OS camera permissions.
- If you previously denied permission, clear the site's camera permission and reload.

### Still Using HTTP or Local IP HTTPS

- The phone must open the tunnel URL beginning with `https://`.
- Do not open the local laptop IP address over plain HTTP for QR scanner testing.
- Do not open `https://192.168.x.x:3000`; local IP HTTPS causes invalid certificate errors on iPhone Safari.
- Do not use `http://localhost:3000` on the phone; that points to the phone itself, not your laptop.

### NEXTAUTH_URL Mismatch

- `NEXTAUTH_URL` must exactly match the public HTTPS tunnel origin.
- Example:

```env
NEXTAUTH_URL="https://your-ngrok-url"
```

- Do not leave it set to `http://localhost:3000` while testing through a tunnel.
- Do not include a trailing slash.
- Restart `npm run dev` every time you change `NEXTAUTH_URL`.

### Dev Server Not Running

- Keep `npm run dev` running in its own terminal.
- Check that `http://localhost:3000` works on the laptop before starting the tunnel.

### Wrong Port

- This project's `npm run dev` uses Next.js default port `3000`.
- If Next.js starts on another port because `3000` is busy, tunnel that port instead:

```powershell
ngrok http 3001
```

or:

```powershell
cloudflared tunnel --url http://localhost:3001
```

Then update `NEXTAUTH_URL` to the new HTTPS tunnel URL and restart the dev server.

### Firewall Blocking Local Access

- Tunnels usually connect to `localhost`, so they may work even when direct phone-to-laptop LAN access is blocked.
- If the tunnel cannot connect, allow Node.js / Next.js through the local firewall.
- Check that security tools are not blocking localhost port `3000`.

### Tunnel Command Not Found

- If `ngrok version` fails, install or configure ngrok.
- If `cloudflared --version` fails, install `cloudflared`.
- Open a new terminal after installing so PATH changes are picked up.

### Tunnel URL Changed After Restart

- Temporary tunnel URLs often change after restarting ngrok or Cloudflare Tunnel.
- Copy the new HTTPS URL into `NEXTAUTH_URL`.
- Restart `npm run dev` after updating `.env`.
- Use a reserved domain only if you intentionally configure one with your tunnel provider.

### Browser Cached Old Permissions

- Clear site permissions for the old tunnel URL.
- Close and reopen the browser tab.
- Try a private/incognito tab for a clean permission prompt.

### PWA or Service Worker Cache Issues

- In development, this project disables `next-pwa`, but a previously installed production PWA or old browser cache can still interfere.
- Remove the installed PWA from the phone if it opens an old URL.
- Clear site data for the old tunnel URL.
- Hard refresh or reopen the HTTPS tunnel URL in a fresh tab.

## Security Notes

- Do not expose production databases, production Stripe keys, or real customer data through a tunnel.
- Do not commit `.env`, `.env.local`, ngrok tokens, Cloudflare tokens, or any real secrets.
- Use test or demo credentials only.
- Stop the tunnel with `Ctrl+C` when testing is finished.
- Treat the tunnel URL as publicly reachable while it is running.
