/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { useSwipeGesture, type SwipeDirection } from "@/hooks/useSwipeGesture";

function SwipeTestComponent({
  onSwipe,
  onTap,
  enabled = true,
}: {
  onSwipe: (direction: SwipeDirection) => void;
  onTap?: () => void;
  enabled?: boolean;
}) {
  const { handlers } = useSwipeGesture({ onSwipe, onTap, enabled });
  return React.createElement("div", {
    style: { width: 300, height: 400 },
    ...handlers,
    "data-testid": "swipe-area",
  });
}

function createPointerEvent(
  type: string,
  overrides: Partial<PointerEventInit> = {},
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: 0,
    clientY: 0,
    ...overrides,
  });
}

describe("useSwipeGesture", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("triggers 'like' on swipe right", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 0, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 50, clientY: 200 }));
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 100, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 100, clientY: 200 }));
    });

    expect(onSwipe).toHaveBeenCalledWith("like");
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("triggers 'pass' on swipe left", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 200, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 150, clientY: 200 }));
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 100, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 100, clientY: 200 }));
    });

    expect(onSwipe).toHaveBeenCalledWith("pass");
  });

  it("triggers 'love' on swipe up", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 300 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 150, clientY: 250 }));
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 150, clientY: 200 }));
    });

    expect(onSwipe).toHaveBeenCalledWith("love");
  });

  it("triggers 'maybe' on swipe down", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 100 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 150, clientY: 150 }));
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 150, clientY: 200 }));
    });

    expect(onSwipe).toHaveBeenCalledWith("maybe");
  });

  it("triggers onTap for small movement, not onSwipe", () => {
    const onSwipe = vi.fn();
    const onTap = vi.fn();
    const { getByTestId } = render(
      React.createElement(SwipeTestComponent, { onSwipe, onTap }),
    );
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 153, clientY: 202 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 153, clientY: 202 }));
    });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("triggers 'seen' on long press", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(onSwipe).toHaveBeenCalledWith("seen");
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("cancels long press if pointer moves", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 165, clientY: 200 }));
    });
    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(onSwipe).not.toHaveBeenCalledWith("seen");
  });

  it("triggers 'skip' on double tap", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 152, clientY: 202 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 152, clientY: 202 }));
    });

    expect(onSwipe).toHaveBeenCalledWith("skip");
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("does not double-tap after the time window expires", () => {
    const onSwipe = vi.fn();
    const onTap = vi.fn();
    const { getByTestId } = render(
      React.createElement(SwipeTestComponent, { onSwipe, onTap }),
    );
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 150, clientY: 200 }));
    });
    expect(onTap).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(350);
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 152, clientY: 202 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 152, clientY: 202 }));
    });

    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onSwipe).not.toHaveBeenCalledWith("skip");
  });

  it("does not fire when disabled", () => {
    const onSwipe = vi.fn();
    const onTap = vi.fn();
    const { getByTestId } = render(
      React.createElement(SwipeTestComponent, { onSwipe, onTap, enabled: false }),
    );
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 0, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 100, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 100, clientY: 200 }));
    });

    expect(onSwipe).not.toHaveBeenCalled();
    expect(onTap).not.toHaveBeenCalled();
  });

  it("ignores second pointer (multi-touch rejection)", () => {
    const onSwipe = vi.fn();
    const { getByTestId } = render(React.createElement(SwipeTestComponent, { onSwipe }));
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 0, clientY: 200, pointerId: 1 }),
      );
    });
    act(() => {
      el.dispatchEvent(
        createPointerEvent("pointerdown", { clientX: 100, clientY: 100, pointerId: 2 }),
      );
    });
    act(() => {
      el.dispatchEvent(
        createPointerEvent("pointermove", { clientX: 300, clientY: 200, pointerId: 2 }),
      );
    });
    act(() => {
      el.dispatchEvent(
        createPointerEvent("pointerup", { clientX: 300, clientY: 200, pointerId: 2 }),
      );
    });

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("resets state on pointer cancel", () => {
    const onSwipe = vi.fn();
    const onTap = vi.fn();
    const { getByTestId } = render(
      React.createElement(SwipeTestComponent, { onSwipe, onTap }),
    );
    const el = getByTestId("swipe-area");

    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 0, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointermove", { clientX: 50, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointercancel", { clientX: 50, clientY: 200 }));
    });

    // After cancel, a new tap should work normally
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerdown", { clientX: 150, clientY: 200 }));
    });
    act(() => {
      el.dispatchEvent(createPointerEvent("pointerup", { clientX: 150, clientY: 200 }));
    });

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
