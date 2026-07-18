# Flashline — Web Photo Booth

An instant, in-browser 4-shot photo booth: live filters, a burst countdown,
and a canvas-composited strip or grid you can download in one click. No
framework runtime, no build step — plain HTML/CSS/JS, deployable as a static
site.

## Run locally

Camera access requires a **secure context**, so you can't just double-click
`index.html`. Serve it over `localhost`:

```bash
npx serve . -l 5500
# then open http://localhost:5500
```

## Project structure

```
index.html          Markup for all four screens (landing/camera/preview/gallery)
css/style.css        Design tokens, signature countdown ring, filter classes
js/store.js          Tiny Proxy-based reactive store (no framework dependency)
js/camera.js          getUserMedia lifecycle + human-readable error mapping
js/filters.js         Shared filter definitions (CSS preview + canvas export)
js/countdown.js       Promise-based countdown with audio-cue hooks
js/canvasEngine.js    Composites 4 shots into a strip/grid, watermark, export
js/app.js             Wires everything together, owns the state
vercel.json           Static hosting config + camera permissions header
```

## Notes

- **HTTPS is mandatory in production.** Vercel serves everything over HTTPS
  by default, so no extra config is needed there — this only bites you if
  you try to host it on plain HTTP elsewhere.
- **Audio cues** are wired up but silent by default — drop `beep.mp3` /
  `shutter.mp3` into `public/` and set the `<audio>` `src` attributes in
  `index.html` (or assign `audioEl.src` in `app.js`) to enable sound.
- **"Share to Cloud"** is an intentionally documented placeholder — see the
  comment above `uploadToCloud()` in `js/app.js` for how to wire in real
  storage (S3, Supabase, Cloudinary, your own API) so the QR code is
  scannable from other devices.
