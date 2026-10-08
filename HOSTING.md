# Run this laptop as the public game server

The laptop only **hosts**. You and your friends **play on other computers or phones**.

Leave the server window open. If that window closes, the cabinet goes offline.

---

## One-time install (on the 24/7 laptop)

1. Install [Node.js 20 or newer](https://nodejs.org) (LTS).
2. Download this project and unzip it, or `git clone` it.
3. Open a terminal **in the project folder** and run:

```bash
npm install
```

4. Stop the laptop from sleeping while it is plugged in:
   - **Windows:** Settings → System → Power → Screen and sleep → Sleep = Never (plugged in). Also turn off “sleep when lid is closed” if you keep the lid shut.
   - **macOS:** System Settings → Battery → Options → Prevent automatic sleeping when display is off.
   - **Linux:** disable suspend in power settings.

---

## Start the dedicated server

### Public on the internet (easiest)

Double-click `start-server-public.bat` on Windows, or run:

```bash
npm run server:public
```

Wait until the terminal prints `WORLD PLAY: https://something.trycloudflare.com`.

- That is the URL friends open on **their** computers.
- The same URL is saved in `server-url.txt`.
- On the laptop, open [http://localhost:3000/console](http://localhost:3000/console) to watch rooms. Do not play there.

The Cloudflare quick-tunnel URL **changes every time you restart**. Send friends the new URL after a reboot, or use the stable method below.

### Public with a stable address (recommended for 24/7)

1. On your router, port-forward **TCP 3000** to this laptop.
2. Copy `.env.example` to `.env`.
3. Set your public address, for example:

```
PUBLIC_URL=http://YOUR.PUBLIC.IP:3000
```

If you have a domain or Dynamic DNS name, use that instead of the raw IP.

4. Start the host (no tunnel needed):

```bash
npm run server
```

Friends always open that same `PUBLIC_URL`.

### Home network only (same Wi‑Fi)

```bash
npm run server
```

Friends on the same Wi‑Fi open `http://LAPTOP-LAN-IP:3000` (the terminal prints `LAN PLAY`).

---

## How friends play (other computers)

1. They open the join URL in a browser (Chrome, Edge, Firefox, Safari).
2. They click **Create Server** to open a room, or **Join Friend** / **World Lobby**.
3. They send the room code or the `?join=CODE` invite to the rest of the group.

Nobody needs to run Node except the laptop.

---

## After a reboot

Start the same command again (`start-server-public.bat` or `npm run server`).

To start automatically on login:

- **Windows:** Task Scheduler → Create task → trigger “At log on” → action: `start-server-public.bat` (set “Start in” to the project folder).
- **macOS / Linux:** add the `npm run server:public` line to your login items, or a systemd user service.

---

## Windows: `'WORLDWIDE' is not recognized`

That happens in Command Prompt if an old start line looks like `WORLDWIDE=1 tsx ...`. Windows thinks `WORLDWIDE` is a program name.

Use one of these instead (in the project folder):

```bat
start-server-public.bat
```

or:

```bat
npm run server:public
```

Do not type `WORLDWIDE=1` in cmd.exe.

---

## If friends cannot connect

- The server window must still be running.
- The laptop must stay awake and online.
- For port-forwarding: the laptop’s local IP may change; give it a reserved DHCP address in the router.
- Firewalls: allow Node / port 3000 inbound.
- Quick tunnels need outbound HTTPS; they do **not** need a router rule.
