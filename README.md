# Pacman Online

An 8-bit arcade cabinet you can host for friends. One player is Pac-Man, the others are ghosts — picked at random or claimed in the lobby before the round starts.

## Play

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

- **Create Server** opens a private room and shows a 4-letter code plus LAN addresses.
- **Join Friend** uses that code. If your friend is running their own machine, put their host (`192.168.x.x:3000`) in Server Host.
- **Play Solo** is local Pac-Man against four AI ghosts.
- **Settings** change name, palettes (arcade, amber CRT, green phosphor, neon, cotton candy, mono), wall/Pac-Man colors, scanlines, glow, pixel scale, and volume.

Production (one port, shareable with friends on your network):

```bash
npm run build
npm start
```

Then open `http://YOUR_LAN_IP:3000`.

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
