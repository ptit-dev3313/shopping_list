import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ListRow, SortableList } from "../src/components/List";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("continue à défiler aux bords même sans nouveau mouvement du pointeur", () => {
  class TestPointer extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  }
  vi.stubGlobal("PointerEvent", TestPointer);
  let frame: FrameRequestCallback = () => {};
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => { frame = next; return 1; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(document, "scrollingElement", { configurable: true, value: document.documentElement });
  vi.stubGlobal("innerHeight", 600);
  const captured = new Set<number>();
  Element.prototype.setPointerCapture = (id) => { captured.add(id); };
  Element.prototype.hasPointerCapture = (id) => captured.has(id);
  Element.prototype.releasePointerCapture = (id) => { captured.delete(id); };
  const reordered = vi.fn();
  const { container } = render(<SortableList onReorder={reordered}>{Array.from({ length: 40 }, (_, index) => <ListRow key={index} label={`ingredient ${index}`} len={40} />)}</SortableList>);
  container.querySelectorAll(".card-row").forEach((element, index) => {
    vi.spyOn(element, "getBoundingClientRect").mockImplementation(() => ({ top: 100 + index * 60 - document.documentElement.scrollTop, height: 60 } as DOMRect));
  });
  const handle = container.querySelector(".drag-handle")!;
  fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 130 });
  fireEvent.pointerMove(handle, { pointerId: 1, clientY: 595 });
  for (let step = 1; step <= 60; step++) frame(step * 16);
  expect(document.documentElement.scrollTop).toBeGreaterThan(500);
  fireEvent.pointerUp(handle, { pointerId: 1, clientY: 595 });
  expect(reordered).toHaveBeenCalledOnce();
  expect(reordered.mock.calls[0][1]).toBeGreaterThan(10);
  expect(captured.size).toBe(0);
  // Drag upwards from the lower part of the list, and cancel without committing.
  fireEvent.pointerDown(handle, { pointerId: 2, button: 0, clientY: 595 });
  fireEvent.pointerMove(handle, { pointerId: 2, clientY: 70 });
  const previous = document.documentElement.scrollTop;
  for (let step = 1; step <= 20; step++) frame(step * 16);
  expect(document.documentElement.scrollTop).toBeLessThan(previous);
  fireEvent.pointerCancel(handle, { pointerId: 2 });
  expect(reordered).toHaveBeenCalledOnce();
});
