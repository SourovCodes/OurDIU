import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlainKey, typingIn, useHotkey } from "./keyboard";

afterEach(() => {
  cleanup();
});

describe("typingIn", () => {
  it("detects fields where a letter would type", () => {
    expect(typingIn(document.createElement("input"))).toBe(true);
    expect(typingIn(document.createElement("textarea"))).toBe(true);
    expect(typingIn(document.createElement("select"))).toBe(true);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(typingIn(editable)).toBe(true);
    expect(typingIn(document.createElement("button"))).toBe(false);
    expect(typingIn(null)).toBe(false);
  });
});

describe("isPlainKey", () => {
  it("matches a bare letter and rejects modifiers, repeats, or typing", () => {
    expect(isPlainKey(new KeyboardEvent("keydown", { key: "t" }), "t")).toBe(
      true,
    );
    expect(isPlainKey(new KeyboardEvent("keydown", { key: "T" }), "t")).toBe(
      true,
    );
    expect(
      isPlainKey(
        new KeyboardEvent("keydown", { key: "t", metaKey: true }),
        "t",
      ),
    ).toBe(false);
    expect(
      isPlainKey(new KeyboardEvent("keydown", { key: "t", repeat: true }), "t"),
    ).toBe(false);

    const typed = new KeyboardEvent("keydown", { key: "t" });
    Object.defineProperty(typed, "target", {
      value: document.createElement("input"),
    });
    expect(isPlainKey(typed, "t")).toBe(false);
  });
});

describe("useHotkey", () => {
  it("runs the handler on a bare key and swallows it only when handled", () => {
    const onKey = vi.fn((): boolean | void => true);
    renderHook(() => useHotkey("t", onKey));
    const event = new KeyboardEvent("keydown", {
      key: "t",
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(onKey).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);

    onKey.mockImplementation(() => {});
    const skipped = new KeyboardEvent("keydown", {
      key: "t",
      cancelable: true,
    });
    window.dispatchEvent(skipped);
    expect(skipped.defaultPrevented).toBe(false);
  });

  it("ignores the key while typing or when disabled", () => {
    const onKey = vi.fn(() => true);
    const { rerender } = renderHook(
      ({ enabled }) => useHotkey("f", onKey, { enabled }),
      { initialProps: { enabled: true } },
    );
    const typed = new KeyboardEvent("keydown", { key: "f" });
    Object.defineProperty(typed, "target", {
      value: document.createElement("input"),
    });
    window.dispatchEvent(typed);
    expect(onKey).not.toHaveBeenCalled();

    rerender({ enabled: false });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    expect(onKey).not.toHaveBeenCalled();
  });
});
