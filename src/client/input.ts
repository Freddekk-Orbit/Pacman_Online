import { dirFromKey } from "../shared/simulation.ts";
import type { Dir } from "../shared/types.ts";

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
    const d = dirFromKey(e.key);
    if (!d) return;
    e.preventDefault();
    this.pressed.add(d);
    this.dir = d;
  };

  private onUp = (e: KeyboardEvent): void => {
    const d = dirFromKey(e.key);
    if (!d) return;
    this.pressed.delete(d);
    const last = [...this.pressed].pop();
    if (last) this.dir = last;
  };

  tap(dir: Dir): void {
    this.dir = dir;
  }
}
