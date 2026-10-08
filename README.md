# Pacman Online

An 8-bit arcade cabinet you can host for friends **anywhere in the world**. One player is Pac-Man, the others are ghosts — picked at random or claimed in the lobby before the round starts.

## 24/7 laptop host (you asked for this)

The laptop **only runs the server**. You and friends **join from other computers**.

```bash
npm install
npm run server:public
```

Leave that window open. On the laptop open `http://localhost:3000/console` (host dashboard, not for playing). Send friends the `WORLD PLAY` URL from the terminal or `server-url.txt`. Full walkthrough: [HOSTING.md](HOSTING.md).

## Play worldwide

Friends do **not** need your LAN IP. They open the same website and use your 4-letter code, or click an invite link:

`https://YOUR-SERVER/?join=A7K2`

### Option A — Deploy the cabinet (best)

Push this repo to [Render](https://render.com) (this repo includes `render.yaml`) or any host that can run Node 20+:

```bash
npm ci
npm run build
npm start
```

Set `PUBLIC_URL=https://your-app.onrender.com` if the host does not send `X-Forwarded-Host`. Then send friends that URL.

Docker:

```bash
docker build -t pacman-online .
docker run -p 3000:3000 -e PUBLIC_URL=https://your.domain pacman-online
```

### Option B — Instant public tunnel from your PC

```bash
npm install
npm run world
```

That builds the game, starts the server, and opens a Cloudflare quick tunnel. Share the printed `https://….trycloudflare.com` link. Anyone on the internet can join rooms on your machine.

### Option C — Local / LAN only

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. LAN friends can still use your local IP if you are on the same network.

## In-game

- **Create Server** — room code + copyable worldwide invite. Optionally list it in the World Lobby.
- **Join Friend** — enter the code. Custom host is only for a different cabinet.
- **World Lobby** — sit down at any listed public room on this server.
- **Play Solo** — local Pac-Man vs four AI ghosts.
- **Settings** — name, palettes, colors, scanlines, glow, scale, volume.

## Controls

- Arrow keys or WASD to move
- On-screen D-pad on phones
- Enter / arrows on the title menu

## Stack

TypeScript throughout. Vite client, Express + WebSocket room server, shared maze simulation so solo and online use the same rules.

## Tests

```bash
npm test
npm run typecheck
```
