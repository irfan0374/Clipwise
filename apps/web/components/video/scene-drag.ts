import type { PointerEvent } from "react";

/** Pointer capture keeps mouse/touch dragging active when the handle leaves its row. */
export function sceneDragHandlers(
  from: number,
  reorder: (from: number, to: number) => void,
  setDragging: (index: number | null) => void,
  setOver: (index: number | null) => void,
) {
  const target = (e: PointerEvent<HTMLButtonElement>) => {
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-reorder-scene]");
    return row ? Number(row.dataset.reorderScene) : -1;
  };
  const clear = () => {
    setDragging(null);
    setOver(null);
  };
  return {
    draggable: false,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(from);
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const to = target(e);
      setOver(to > 0 ? to : null);
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const to = target(e);
      e.currentTarget.releasePointerCapture(e.pointerId);
      clear();
      if (to > 0 && to !== from) reorder(from, to);
    },
    onPointerCancel: clear,
    onLostPointerCapture: clear,
  };
}
