# Portfolio (Frontend + Backend)

## Setup (sirf 2 steps, npm install ki zaroorat nahi)
1. Node.js install karo (v18+): https://nodejs.org
2. Is folder me terminal kholo aur chalao:
   ```
   npm start
   ```
3. Browser me kholo: http://localhost:5000

## Messages kaha save hote hain?
`data/messages.json` file me. Dekhne ke liye http://localhost:5000/admin kholo aur `.env` wala `ADMIN_KEY` daalo.

## Important
- `.env` me `ADMIN_KEY` zaroor badlo.
- Frontend: `public/index.html`  |  Backend: `server.js`
- Deploy (Render/Railway/VPS): `npm start` chalao; `data/` folder persistent disk par rakho.
- API: `POST /api/contact` {name,email,message}
