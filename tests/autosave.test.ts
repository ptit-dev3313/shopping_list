import { expect, it, vi } from "vitest";
import { Autosave } from "../src/lib/autosave";

it("n’envoie pas les données initiales sans modification", async () => {
  const save = vi.fn();
  const queue = new Autosave({ count: 0 }, 4, save, vi.fn(), vi.fn());
  expect(await queue.flush()).toBe(true);
  expect(save).not.toHaveBeenCalled();
});

it("sérialise les changements pendant un envoi et attend le dernier avant de quitter", async () => {
  let finish!: (revision: number) => void;
  const save = vi.fn().mockImplementationOnce(() => new Promise<number>((resolve) => { finish = resolve; })).mockResolvedValueOnce(6);
  const draft = vi.fn();
  const queue = new Autosave({ count: 0 }, 4, save, vi.fn(), draft);
  queue.edit({ count: 1 });
  const flushing = queue.flush();
  queue.edit({ count: 2 });
  queue.edit({ count: 3 });
  expect(queue.flush()).toBe(flushing);
  expect(save).toHaveBeenCalledTimes(1);
  finish(5);
  expect(await flushing).toBe(true);
  expect(save).toHaveBeenNthCalledWith(2, { count: 3 }, 5);
  expect(queue.revision).toBe(6);
  expect(queue.dirty).toBe(false);
  expect(draft).toHaveBeenLastCalledWith(null);
});

it("conserve le brouillon et la révision en cas de refus, puis permet une reprise", async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error("Hors ligne")).mockResolvedValueOnce(9);
  const draft = vi.fn();
  const queue = new Autosave({ count: 0 }, 8, save, vi.fn(), draft);
  queue.edit({ count: 1 });
  expect(await queue.flush()).toBe(false);
  expect(queue.status).toBe("error");
  expect(queue.dirty).toBe(true);
  expect(queue.revision).toBe(8);
  expect(draft).not.toHaveBeenCalledWith(null);
  queue.edit({ count: 2 });
  expect(await queue.flush()).toBe(true);
  expect(save).toHaveBeenLastCalledWith({ count: 2 }, 8);
  expect(queue.status).toBe("saved");
});

it("un conflit conserve la révision de base sans forcer un écrasement", async () => {
  const save = vi.fn().mockRejectedValue(new Error("Conflit"));
  const queue = new Autosave({ count: 0 }, 1, save, vi.fn(), vi.fn());
  queue.edit({ count: 1 });
  await queue.flush(); await queue.flush();
  expect(save.mock.calls.map((call) => call[1])).toEqual([1, 1]);
  expect(queue.dirty).toBe(true);
});
