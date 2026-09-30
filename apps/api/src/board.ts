import type { TrackUpdate } from "@harborwatch/contracts";

export interface TrackRecord extends TrackUpdate {
  seq: number;
  site_id: string;
  received_at: number;
}

export interface BoardOptions {
  staleMs: number;
  expireMs: number;
}

export class SiteBoard {
  readonly tracks = new Map<string, TrackRecord>();
  private nextSeq = 1;

  constructor(private readonly options: BoardOptions) {}

  apply(
    siteId: string,
    update: TrackUpdate,
    incomingSeq?: number,
  ): TrackRecord | null {
    const prev = this.tracks.get(update.track_id);
    const seq = incomingSeq ?? this.nextSeq++;
    if (incomingSeq === undefined) {
      this.nextSeq = Math.max(this.nextSeq, seq + 1);
    } else {
      this.nextSeq = Math.max(this.nextSeq, incomingSeq + 1);
    }
    if (prev && seq <= prev.seq) {
      return null;
    }
    const record: TrackRecord = {
      ...update,
      seq,
      site_id: siteId,
      received_at: Date.now(),
    };
    this.tracks.set(update.track_id, record);
    return record;
  }

  expire(now = Date.now()): string[] {
    const removed: string[] = [];
    for (const [id, track] of this.tracks) {
      const age = now - Date.parse(track.last_seen);
      if (!Number.isFinite(age) || age > this.options.expireMs) {
        this.tracks.delete(id);
        removed.push(id);
      }
    }
    return removed;
  }

  isStale(track: TrackRecord, now = Date.now()): boolean {
    const age = now - Date.parse(track.last_seen);
    return age > this.options.staleMs;
  }

  snapshot(): TrackRecord[] {
    this.expire();
    return [...this.tracks.values()];
  }

  get(trackId: string): TrackRecord | undefined {
    return this.tracks.get(trackId);
  }

  size(): number {
    return this.tracks.size;
  }
}
