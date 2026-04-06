# UI demo videos

Generated screen recordings of the web app for reviews and changelog context.

## Record the homepage (glass UI + form)

1. Start the Next.js dev server (from repo root):

   ```bash
   bun run dev:web
   ```

2. In another terminal, from repo root:

   ```bash
   bun run demo:homepage
   ```

   Or from `apps/web`:

   ```bash
   bun run demo:record-homepage
   ```

   Uses `BASE_URL` (default `http://127.0.0.1:3000`). Override if your dev server uses another port:

   ```bash
   BASE_URL=http://127.0.0.1:3001 bun run demo:homepage
   ```

3. Outputs (in this directory):

   - `ferro-homepage-demo.webm` — VP8/VP9 from Chromium (always produced)
   - `ferro-homepage-demo.mp4` — H.264, if `ffmpeg` is on your `PATH`

Requires [Playwright](https://playwright.dev/) Chromium (installed via `bunx playwright install chromium` in `apps/web` after `bun install`).

### Headless (CI only)

The recorder **defaults to a visible browser window** because headless Chromium often captures a **black video** for dark, GPU-heavy pages (e.g. backdrop blur). In CI or SSH without a display, force headless:

```bash
DEMO_HEADLESS=1 bun run demo:homepage
```

### System Chrome (optional)

If installed, the script uses **Google Chrome** (`channel: 'chrome'`) for more reliable compositing. To force bundled Chromium instead:

```bash
PW_CHANNEL=chromium bun run demo:homepage
```
