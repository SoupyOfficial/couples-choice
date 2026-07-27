import { useCallback, useEffect, useRef } from "react";

export type SwipeDirection = "love" | "like" | "maybe" | "pass" | "seen" | "skip";

export interface UseSwipeGestureOptions {
  onSwipe: (direction: SwipeDirection) => void;
  onTap?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  longPressMs?: number;
  doubleTapMs?: number;
  enabled?: boolean;
}

export interface UseSwipeGestureReturn {
  handlers: {
    onPointerDown: React.PointerEventHandler;
    onPointerMove: React.PointerEventHandler;
    onPointerUp: React.PointerEventHandler;
    onPointerCancel: React.PointerEventHandler;
  };
}

export function useSwipeGesture(options: UseSwipeGestureOptions): UseSwipeGestureReturn {
  const {
    onSwipe,
    onTap,
    threshold: userThreshold,
    velocityThreshold = 0.3,
    longPressMs = 600,
    doubleTapMs = 300,
    enabled = true,
  } = options;

  const horizontalThreshold = userThreshold ?? 80;
  const verticalThreshold = userThreshold ?? 50;

  const onSwipeRef = useRef(onSwipe);
  const onTapRef = useRef(onTap);
  const enabledRef = useRef(enabled);
  const longPressMsRef = useRef(longPressMs);
  const doubleTapMsRef = useRef(doubleTapMs);
  const horizontalThresholdRef = useRef(horizontalThreshold);
  const verticalThresholdRef = useRef(verticalThreshold);
  const velocityThresholdRef = useRef(velocityThreshold);

  onSwipeRef.current = onSwipe;
  onTapRef.current = onTap;
  enabledRef.current = enabled;
  longPressMsRef.current = longPressMs;
  doubleTapMsRef.current = doubleTapMs;
  horizontalThresholdRef.current = horizontalThreshold;
  verticalThresholdRef.current = verticalThreshold;
  velocityThresholdRef.current = velocityThreshold;

  const stateRef = useRef({
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startTime: 0,
    lastTime: 0,
    totalMovement: 0,
    isDragging: false,
    longPressTimer: null as ReturnType<typeof setTimeout> | null,
    lastTapTime: 0,
    hasMoved: false,
  });

  const resetState = useCallback(() => {
    const state = stateRef.current;
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    state.pointerId = -1;
    state.isDragging = false;
    state.hasMoved = false;
    state.totalMovement = 0;
  }, []);

  useEffect(() => {
    return () => {
      const state = stateRef.current;
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
      }
    };
  }, []);

  const distance = (x1: number, y1: number, x2: number, y2: number): number =>
    Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabledRef.current) return;

    const state = stateRef.current;
    if (state.pointerId !== -1) return;

    state.pointerId = e.pointerId;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.startTime = Date.now();
    state.lastTime = Date.now();
    state.totalMovement = 0;
    state.isDragging = false;
    state.hasMoved = false;

    if (state.longPressTimer) clearTimeout(state.longPressTimer);
    state.longPressTimer = setTimeout(() => {
      const s = stateRef.current;
      if (!s.hasMoved && !s.isDragging) {
        onSwipeRef.current("seen");
        resetState();
      }
    }, longPressMsRef.current);
  }, [resetState]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!enabledRef.current) return;

    const state = stateRef.current;
    if (e.pointerId !== state.pointerId) return;

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const dt = Date.now() - state.lastTime;
    const movement = distance(state.startX, state.startY, e.clientX, e.clientY);

    state.totalMovement = movement;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.lastTime = Date.now();

    if (movement > 10) {
      if (state.longPressTimer) {
        clearTimeout(state.longPressTimer);
        state.longPressTimer = null;
      }
      state.hasMoved = true;
      state.isDragging = true;
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!enabledRef.current) return;

    const state = stateRef.current;
    if (e.pointerId !== state.pointerId) return;

    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }

    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const elapsed = Date.now() - state.startTime;

    if (state.totalMovement <= 10) {
      const now = Date.now();
      if (state.lastTapTime > 0 && (now - state.lastTapTime) <= doubleTapMsRef.current) {
        onSwipeRef.current("skip");
        state.lastTapTime = 0;
      } else {
        onTapRef.current?.();
        state.lastTapTime = now;
      }
      resetState();
      return;
    }

    const velocityX = elapsed > 0 ? Math.abs(dx) / elapsed : 0;
    const velocityY = elapsed > 0 ? Math.abs(dy) / elapsed : 0;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let direction: SwipeDirection | null = null;

    if (absDx >= horizontalThresholdRef.current || velocityX >= velocityThresholdRef.current) {
      if (absDx > absDy) {
        direction = dx > 0 ? "like" : "pass";
      }
    }

    if (!direction && (absDy >= verticalThresholdRef.current || velocityY >= velocityThresholdRef.current)) {
      direction = dy < 0 ? "love" : "maybe";
    }

    if (direction) {
      onSwipeRef.current(direction);
    }

    resetState();
  }, [resetState]);

  const onPointerCancel = useCallback(() => {
    resetState();
  }, [resetState]);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
