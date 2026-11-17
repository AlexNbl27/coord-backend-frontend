export interface SeatRow {
  label: string;
  count: number;
}

export interface SeatLayout {
  capacity: number;
  cols: number;
  rows: SeatRow[];
}

export interface SeatMapResponse {
  slotId: string;
  version: number;
  layout: SeatLayout;
  taken: string[];
}

export function seatId(row: string, n: number): string {
  return `${row}${n}`;
}

export function parseSeat(id: string): { row: string; number: number } {
  return { row: id.charAt(0), number: Number.parseInt(id.slice(1), 10) };
}

export function rowOffset(layout: SeatLayout, row: SeatRow): number {
  return Math.floor((layout.cols - row.count) / 2);
}

export function columnOf(layout: SeatLayout, id: string): number {
  const { row, number } = parseSeat(id);
  const r = layout.rows.find((x) => x.label === row);
  return r ? rowOffset(layout, r) + number - 1 : -1;
}

export function aisleWidth(cols: number): number {
  return Math.floor(cols / 5);
}

export function sortSeats(layout: SeatLayout, seats: string[]): string[] {
  const order = new Map(layout.rows.map((r, i) => [r.label, i]));
  return [...seats].sort((a, b) => {
    const pa = parseSeat(a);
    const pb = parseSeat(b);
    return (order.get(pa.row) ?? 0) - (order.get(pb.row) ?? 0) || pa.number - pb.number;
  });
}

function rowPreference(rowCount: number): number[] {
  const target = Math.round((rowCount - 1) * 0.6);
  return Array.from({ length: rowCount }, (_, i) => i)
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a);
}

export function pickBestSeats(layout: SeatLayout, taken: Iterable<string>, quantity: number): string[] | null {
  const takenSet = new Set(taken);
  const order = rowPreference(layout.rows.length);

  for (const rowIndex of order) {
    const row = layout.rows[rowIndex];
    const center = (row.count + 1) / 2;
    let best: { start: number; distance: number } | null = null;
    for (let start = 1; start + quantity - 1 <= row.count; start += 1) {
      let free = true;
      for (let n = start; n < start + quantity; n += 1) {
        if (takenSet.has(seatId(row.label, n))) { free = false; break; }
      }
      if (!free) continue;
      const distance = Math.abs(start + (quantity - 1) / 2 - center);
      if (!best || distance < best.distance) best = { start, distance };
    }
    if (best) {
      const start = best.start;
      return Array.from({ length: quantity }, (_, i) => seatId(row.label, start + i));
    }
  }

  const rank = new Map(order.map((rowIndex, i) => [layout.rows[rowIndex].label, i]));
  const free = layout.rows
    .flatMap((row) => Array.from({ length: row.count }, (_, i) => ({ row, n: i + 1 })))
    .filter(({ row, n }) => !takenSet.has(seatId(row.label, n)))
    .map(({ row, n }) => ({ id: seatId(row.label, n), rowRank: rank.get(row.label) ?? 0, offset: Math.abs(n - (row.count + 1) / 2) }))
    .sort((a, b) => a.rowRank - b.rowRank || a.offset - b.offset);

  return free.length >= quantity ? free.slice(0, quantity).map((s) => s.id) : null;
}

export function formatSeatList(layout: SeatLayout, seats: string[]): string {
  return sortSeats(layout, seats).join(', ');
}
