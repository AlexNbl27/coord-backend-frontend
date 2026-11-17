export const ROW_LABELS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
export const SEAT_ID_PATTERN = /^[A-HJ-NP-Z](?:[1-9]|1[0-6])$/;
export const MAX_SEATS_PER_BOOKING = 10;

function columnsFor(capacity) {
  if (capacity <= 60) return 10;
  if (capacity <= 120) return 12;
  return 16;
}

export function buildSeatLayout(rawCapacity) {
  const cols = columnsFor(Math.max(1, Number(rawCapacity) || 1));
  const capacity = Math.min(Math.max(1, Math.floor(Number(rawCapacity) || 1)), ROW_LABELS.length * cols);
  const rowCount = Math.ceil(capacity / cols);
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    label: ROW_LABELS[i],
    count: i === rowCount - 1 ? capacity - cols * (rowCount - 1) : cols
  }));
  return { capacity, cols, rows };
}

export function layoutSeatIds(layout) {
  return layout.rows.flatMap((row) => Array.from({ length: row.count }, (_, i) => `${row.label}${i + 1}`));
}

export function parseSeatId(id) {
  return { row: id.charAt(0), number: Number.parseInt(id.slice(1), 10) };
}

export function normalizeSeatInput(raw) {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SEATS_PER_BOOKING) return false;
  const seats = raw.map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''));
  return seats.every((s) => SEAT_ID_PATTERN.test(s)) ? seats : false;
}

export function isValidSeatSelection(seats, capacity, quantity) {
  if (!Array.isArray(seats) || seats.length !== quantity) return false;
  if (new Set(seats).size !== seats.length) return false;
  const valid = new Set(layoutSeatIds(buildSeatLayout(capacity)));
  return seats.every((s) => valid.has(s));
}

function rowPreference(rowCount) {
  const target = Math.round((rowCount - 1) * 0.6);
  return Array.from({ length: rowCount }, (_, i) => i)
    .sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || b - a);
}

export function pickBestSeats(layout, taken, quantity) {
  const takenSet = new Set(taken ?? []);
  const order = rowPreference(layout.rows.length);

  for (const rowIndex of order) {
    const row = layout.rows[rowIndex];
    const center = (row.count + 1) / 2;
    let best = null;
    for (let start = 1; start + quantity - 1 <= row.count; start += 1) {
      const block = Array.from({ length: quantity }, (_, i) => start + i);
      if (block.some((n) => takenSet.has(`${row.label}${n}`))) continue;
      const distance = Math.abs(start + (quantity - 1) / 2 - center);
      if (!best || distance < best.distance) best = { start, distance };
    }
    if (best) {
      return Array.from({ length: quantity }, (_, i) => `${row.label}${best.start + i}`);
    }
  }

  const rank = new Map(order.map((rowIndex, i) => [layout.rows[rowIndex].label, i]));
  const free = layoutSeatIds(layout)
    .filter((id) => !takenSet.has(id))
    .map((id) => {
      const { row, number } = parseSeatId(id);
      const count = layout.rows.find((r) => r.label === row).count;
      return { id, rowRank: rank.get(row), offset: Math.abs(number - (count + 1) / 2) };
    })
    .sort((a, b) => a.rowRank - b.rowRank || a.offset - b.offset);

  return free.length >= quantity ? free.slice(0, quantity).map((s) => s.id) : null;
}

export function sortSeats(seats) {
  return [...seats].sort((a, b) => {
    const pa = parseSeatId(a);
    const pb = parseSeatId(b);
    return ROW_LABELS.indexOf(pa.row) - ROW_LABELS.indexOf(pb.row) || pa.number - pb.number;
  });
}
