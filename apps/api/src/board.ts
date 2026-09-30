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

export interface ExpiredTrack {
  site_id: string;
  track_id: string;
}

export class SiteBoard {
  readonly tracks = new Map<string, TrackRecord>();
  private nextSeq = 1;

  constructor(private readonly options: BoardOptions) {}

  apply(siteId: string, update: TrackUpdate, incomingSeq?: number): TrackRecord | null {
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

export class HarborBoards {
  private readonly boards = new Map<string, SiteBoard>();

  constructor(
    private readonly options: BoardOptions,
    siteIds: string[],
  ) {
    for (const siteId of siteIds) {
      this.boards.set(siteId, new SiteBoard(options));
    }
  }

  apply(siteId: string, update: TrackUpdate, incomingSeq?: number): TrackRecord | null {
    const board = this.boards.get(siteId);
    if (!board) return null;
    return board.apply(siteId, update, incomingSeq);
  }

  expire(now = Date.now()): ExpiredTrack[] {
    const removed: ExpiredTrack[] = [];
    for (const [siteId, board] of this.boards) {
      for (const trackId of board.expire(now)) {
        removed.push({ site_id: siteId, track_id: trackId });
      }
    }
    return removed;
  }

  isStale(track: TrackRecord, now = Date.now()): boolean {
    const board = this.boards.get(track.site_id);
    return board ? board.isStale(track, now) : true;
  }

  snapshot(siteId?: string): TrackRecord[] {
    if (siteId) return this.boards.get(siteId)?.snapshot() ?? [];
    return [...this.boards.values()].flatMap((board) => board.snapshot());
  }

  get(trackId: string, siteId?: string): TrackRecord | undefined {
    if (siteId) return this.boards.get(siteId)?.get(trackId);
    for (const board of this.boards.values()) {
      const hit = board.get(trackId);
      if (hit) return hit;
    }
    return undefined;
  }

  size(siteId?: string): number {
    if (siteId) return this.boards.get(siteId)?.size() ?? 0;
    let total = 0;
    for (const board of this.boards.values()) total += board.size();
    return total;
  }

  siteIds(): string[] {
    return [...this.boards.keys()];
  }
}
