import { useRef, useCallback } from "react";
import { useSelectionStore } from "../store/selectionStore";

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipeNavigation(
  onPrev?: () => void,
  onNext?: () => void
): SwipeHandlers {
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchRef.current) return;
      const { isDragging } = useSelectionStore.getState();
      if (isDragging) {
        touchRef.current = null;
        return;
      }

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchRef.current.x;
      const dy = touch.clientY - touchRef.current.y;
      const elapsed = Date.now() - touchRef.current.t;
      touchRef.current = null;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50 && elapsed < 500) {
        if (dx < 0) {
          onNext?.();
        } else {
          onPrev?.();
        }
      }
    },
    [onPrev, onNext]
  );

  return { onTouchStart, onTouchEnd };
}
