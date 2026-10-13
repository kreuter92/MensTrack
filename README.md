# MensTrack

Private menstrual cycle tracker as a progressive web app. All data stays in the browser's local storage on your device.

## Run locally

```powershell
python main.py
```

Opens a static server for `static/` on port 8000 and prints the local and network URLs.

## Install on iPhone

iOS requires HTTPS for offline support (service worker), so host `static/` on any HTTPS static host (GitHub Pages, Netlify, Cloudflare Pages), then:

1. Open the URL in Safari.
2. Share > Add to Home Screen.

Over plain `http://<LAN-IP>:8000` the app can be added to the Home Screen and runs, but without offline caching.

## Notes

- Use Export regularly; the Home Screen app has its own storage, separate from Safari.
- Predictions use the average of your last 6 cycles (28 days by default). Fertile window and ovulation are rough estimates, not medical advice.
