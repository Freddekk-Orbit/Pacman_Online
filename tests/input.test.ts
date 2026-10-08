/** @vitest-environment jsdom */

import { Input, isTypingTarget } from "../src/client/input.ts";

describe("isTypingTarget", () => {
  it("treats form fields as typing targets", () => {
    expect(isTypingTarget(document.createElement("input"))).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(document.createElement("select"))).toBe(true);
  });

  it("ignores the rest of the page", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.createElement("canvas"))).toBe(false);
  });

  it("does not treat hidden menu fields as typing targets", () => {
    const wrap = document.createElement("div");
    wrap.className = "screen hidden";
    const field = document.createElement("input");
    wrap.appendChild(field);
    document.body.appendChild(wrap);
    expect(isTypingTarget(field)).toBe(false);
    wrap.remove();
  });
});

describe("Input", () => {
  it("does not steal WASD from a text field", () => {
    const controls = new Input();
    controls.attach();
    const field = document.createElement("input");
    document.body.appendChild(field);
    const down = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    field.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(controls.dir).toBe("none");
    field.value += "a";
    expect(field.value).toBe("a");
    controls.detach();
    field.remove();
  });

  it("captures WASD even if a hidden join/host field is focused", () => {
    const controls = new Input();
    controls.attach();
    const wrap = document.createElement("div");
    wrap.className = "hidden";
    const field = document.createElement("input");
    wrap.appendChild(field);
    document.body.appendChild(wrap);
    const down = new KeyboardEvent("keydown", { key: "w", bubbles: true, cancelable: true });
    field.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(controls.dir).toBe("up");
    controls.detach();
    wrap.remove();
  });

  it("still captures WASD outside of fields", () => {
    const controls = new Input();
    controls.attach();
    const down = new KeyboardEvent("keydown", { key: "d", bubbles: true, cancelable: true });
    window.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(controls.dir).toBe("right");
    controls.detach();
  });
});
