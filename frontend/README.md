# AuraMeet frontend

Vite, React, and JavaScript frontend for the AuraMeet backend.

## Run locally

1. Copy `.env.example` to `.env` if you need to change the local API URLs.
2. Run `npm install`.
3. Run `npm run dev` and open the URL Vite prints (default `http://localhost:5173`).

Run `npm run build` to create the production bundle in `dist/`.

Access and refresh tokens stay in JavaScript memory only. Reloading the page clears the session and requires signing in again. Camera, microphone, screen capture, and peer-to-peer media require browser permission; browser media APIs work on localhost or a secure origin. WebRTC uses a public STUN server; restrictive networks may need a TURN relay configured in `src/hooks/useWebRTC.js`.
