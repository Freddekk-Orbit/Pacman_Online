import { PALETTES, getPalette } from "../shared/palettes.ts";
import type { GraphicsSettings, Palette } from "../shared/types.ts";
import { DEFAULT_GRAPHICS } from "../shared/types.ts";

const KEY = "pacman-online-settings";

export interface LocalSettings {
  name: string;
  graphics: GraphicsSettings;
  sfx: number;
  music: number;
}

export const DEFAULT_LOCAL: LocalSettings = {
  name: "PLAYER",
  graphics: { ...DEFAULT_GRAPHICS },
  sfx: 0.45,
  music: 0.22,
};

export function loadSettings(): LocalSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_LOCAL, graphics: { ...DEFAULT_GRAPHICS, custom: {} } };
    const parsed = JSON.parse(raw) as LocalSettings;
    return {
      ...DEFAULT_LOCAL,
      ...parsed,
      graphics: { ...DEFAULT_GRAPHICS, ...parsed.graphics, custom: parsed.graphics?.custom ?? {} },
    };
  } catch {
    return { ...DEFAULT_LOCAL, graphics: { ...DEFAULT_GRAPHICS, custom: {} } };
  }
}

export function saveSettings(s: LocalSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function activePalette(s: LocalSettings): Palette {
  return getPalette(s.graphics.paletteId, s.graphics.custom);
}

export function applyTheme(palette: Palette, graphics: GraphicsSettings): void {
  const root = document.documentElement;
  root.style.setProperty("--bg", palette.bg);
  root.style.setProperty("--wall", palette.wall);
  root.style.setProperty("--pac", palette.pac);
  root.style.setProperty("--text", palette.text);
  root.style.setProperty("--muted", palette.muted);
  root.style.setProperty("--accent", palette.accent);
  root.style.setProperty("--hud", palette.hud);
  root.style.setProperty("--blinky", palette.blinky);
  root.style.setProperty("--pinky", palette.pinky);
  root.style.setProperty("--inky", palette.inky);
  root.style.setProperty("--clyde", palette.clyde);

  const crt = document.getElementById("crt");
  if (!crt) return;
  crt.classList.toggle("scanlines", graphics.scanlines);
  crt.classList.toggle("glow", graphics.crtGlow);
}

export { PALETTES };
