export type SaveStatus = "saved" | "pending" | "saving" | "error";

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
  private draft: (value: { data: T; revision: number } | null) => void;

  constructor(data: T, revision: number,
    save: (data: T, revision: number) => Promise<number>,
    changed: () => void,
    draft: (value: { data: T; revision: number } | null) => void) {
    this.data = data; this.revision = revision; this.save = save;
    this.changed = changed; this.draft = draft;
  }

  edit(data: T) {
    this.data = data;
    this.dirty = true;
    if (this.status !== "error") this.status = "pending";
    this.draft({ data, revision: this.revision });
    this.changed();
  }

  flush(): Promise<boolean> {
    if (this.flight) return this.flight;
    this.flight = this.run().finally(() => { this.flight = null; });
    return this.flight;
  }

  private async run(): Promise<boolean> {
    while (this.dirty) {
      const snapshot = this.data;
      this.status = "saving";
      this.changed();
      try {
        this.revision = await this.save(snapshot, this.revision);
      } catch (error) {
        this.status = "error";
        this.message = error instanceof Error ? error.message : "Enregistrement impossible";
        this.changed();
        return false;
      }
      this.dirty = this.data !== snapshot;
      this.draft(this.dirty ? { data: this.data, revision: this.revision } : null);
    }
    this.status = "saved";
    this.message = "";
    this.changed();
    return true;
  }
}
