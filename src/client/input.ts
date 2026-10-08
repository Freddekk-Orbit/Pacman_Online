import { dirFromKey } from "../shared/simulation.ts";
import type { Dir } from "../shared/types.ts";

/** True when a key event is aimed at a visible field that should receive letters as-is. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    disabled?: boolean;
    closest?: (selector: string) => Element | null;
  };
  const tag = String(el.tagName || "").toUpperCase();
  const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el.isContentEditable);
  if (!typing) return false;
  if (el.disabled) return false;
  if (typeof el.closest === "function" && el.closest(".hidden")) return false;
  return true;
}

export class Input {
  dir: Dir = "none";
  private pressed = new Set<Dir>();

  attach(): void {
    window.addEventListener("keydown", this.onDown);
    window.addEventListener("keyup", this.onUp);
  }

  detach(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
  }

  private onDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target)) return;
    const d = dirFromKey(e.key);
    if (!d) return;
    e.preventDefault();
    this.pressed.add(d);
    this.dir = d;
  };

  private onUp = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target)) return;
    const d = dirFromKey(e.key);
    if (!d) return;
    this.pressed.delete(d);
    const last = [...this.pressed].pop();
    if (last) this.dir = last;
  };

  tap(dir: Dir): void {
    this.dir = dir;
  }

  reset(): void {
    this.pressed.clear();
    this.dir = "none";
  }
}
