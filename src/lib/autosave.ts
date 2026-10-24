import { RevisionConflict, sameData } from "./sync";
export type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";
export type Draft<T> = { data: T; revision: number; base?: T };
type Synchronizer<T> = { load: () => Promise<{ data: T; revision: number }>; merge: (base: T | undefined, local: T, remote: T) => T };

// One queue per loaded space. A completed request must never mark newer edits saved.
export class Autosave<T> {
  dirty = false;
  status: SaveStatus = "saved";
  message = "";
  private flight: Promise<boolean> | null = null;
  data: T;
  revision: number;
  private save: (data: T, revision: number) => Promise<number>;
  private changed: () => void;
  private draft: (value: Draft<T> | null) => void;
  private base: T | undefined;
  private sync?: Synchronizer<T>;

  constructor(data: T, revision: number,
    save: (data: T, revision: number) => Promise<number>,
    changed: () => void,
    draft: (value: Draft<T> | null) => void, sync?: Synchronizer<T>) {
    this.data = data; this.revision = revision; this.save = save;
    this.changed = changed; this.draft = draft;
    this.base = data; this.sync = sync;
  }

  private remember() { this.draft(this.dirty ? { data: this.data, revision: this.revision, base: this.base } : null); }
  snapshot(): Draft<T> { return { data: this.data, revision: this.revision, base: this.base }; }
  get isSaving() { return this.flight !== null; }
  private conflict() {
    this.status = "conflict";
    this.message = "Les changements de cet appareil et de l’espace partagé se chevauchent. Conservez votre brouillon dans un espace séparé pour reprendre sans écraser les autres modifications.";
    this.changed();
  }
  restore(draft: Draft<T>) {
    const remote = this.data, revision = this.revision;
    this.data = draft.data; this.revision = draft.revision; this.base = draft.base;
    this.dirty = true;
    if (revision === draft.revision) this.base = remote;
    else if (this.sync) {
      try { this.data = this.sync.merge(draft.base, draft.data, remote); this.base = remote; this.revision = revision; }
      catch { this.conflict(); return; }
    }
    this.dirty = !sameData(this.data, remote);
    this.status = this.dirty ? "pending" : "saved";
    this.remember(); this.changed();
  }

  edit(data: T) {
    this.data = data;
    this.dirty = true;
    if (this.status !== "error" && this.status !== "conflict" && this.status !== "saving") this.status = "pending";
    this.remember();
    this.changed();
  }

  flush(): Promise<boolean> {
    if (this.flight) return this.flight;
    if (this.status === "conflict") return Promise.resolve(false);
    this.flight = this.run().finally(() => { this.flight = null; });
    return this.flight;
  }

  private async run(): Promise<boolean> {
    let retries = 0;
    while (this.dirty) {
      const snapshot = this.data;
      this.status = "saving";
      this.changed();
      try {
        this.revision = await this.save(snapshot, this.revision);
      } catch (error) {
        if (error instanceof RevisionConflict && this.sync) {
          try {
            if (++retries > 3) { this.conflict(); return false; }
            const remote = await this.sync.load();
            this.data = this.sync.merge(this.base, this.data, remote.data);
            this.base = remote.data; this.revision = remote.revision;
            this.dirty = !sameData(this.data, remote.data);
            this.remember(); this.changed();
            continue;
          } catch (syncError) {
            if (syncError instanceof RevisionConflict) { this.conflict(); return false; }
            error = syncError;
          }
        }
        this.status = "error";
        this.message = error instanceof Error ? error.message : "Enregistrement impossible";
        this.changed();
        return false;
      }
      this.base = snapshot;
      this.dirty = this.data !== snapshot;
      this.remember();
    }
    this.status = "saved";
    this.message = "";
    this.changed();
    return true;
  }
}
