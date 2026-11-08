import { BookingStat } from '../models/BookingStat.js';
import { PARIS_TIME_ZONE } from '../utils/ticketFormatters.js';

const parisDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: PARIS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function parisDay(date) {
  return parisDayFormat.format(new Date(date));
}

export function statDelta(entry) {
  const quantity = Number(entry?.quantity) || 0;
  let inc;
  if (entry?.action === 'BOOKED') inc = { booked: 1, cancelled: 0, seats: quantity };
  else if (entry?.action === 'CANCELLED') inc = { booked: 0, cancelled: 1, seats: -quantity };
  else return null;
  if (!entry.cinemaSlug || !entry.movieId || !entry.bookingId || !entry.at) return null;
  return {
    key: { cinemaSlug: String(entry.cinemaSlug), movieId: String(entry.movieId), day: parisDay(entry.at) },
    inc,
    eventKey: `${entry.bookingId}:${entry.action}`
  };
}

export async function applyReservationEvent(entry, stats = BookingStat) {
  const delta = statDelta(entry);
  if (!delta) return false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await stats.updateOne(
        { ...delta.key, applied: { $ne: delta.eventKey } },
        { $inc: delta.inc, $push: { applied: delta.eventKey } },
        { upsert: true }
      );
      return true;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  return false;
}

export async function recomputeBookingStats(logs, stats = BookingStat) {
  const totals = new Map();
  for await (const entry of logs) {
    const delta = statDelta(entry);
    if (!delta) continue;
    const id = `${delta.key.cinemaSlug}|${delta.key.movieId}|${delta.key.day}`;
    const row = totals.get(id) ?? { ...delta.key, booked: 0, cancelled: 0, seats: 0, applied: [] };
    if (row.applied.includes(delta.eventKey)) continue;
    row.booked += delta.inc.booked;
    row.cancelled += delta.inc.cancelled;
    row.seats += delta.inc.seats;
    row.applied.push(delta.eventKey);
    totals.set(id, row);
  }
  const recomputedAt = new Date();
  const rows = [...totals.values()];
  if (rows.length > 0) {
    await stats.bulkWrite(rows.map((row) => ({
      replaceOne: {
        filter: { cinemaSlug: row.cinemaSlug, movieId: row.movieId, day: row.day },
        replacement: { ...row, recomputedAt },
        upsert: true
      }
    })), { ordered: false });
  }
  await stats.deleteMany({ recomputedAt: { $ne: recomputedAt } });
  return rows.length;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const GROUP_FIELDS = { cinema: '$cinemaSlug', movie: '$movieId' };

export function buildStatsQuery(query, user) {
  const groupBy = query.groupBy ?? 'movie';
  if (typeof groupBy !== 'string' || !Object.hasOwn(GROUP_FIELDS, groupBy)) return { status: 400, detail: 'groupBy doit valoir cinema ou movie.' };
  for (const name of ['cinema', 'movie', 'from', 'to']) {
    if (query[name] !== undefined && (typeof query[name] !== 'string' || query[name].length > 64)) {
      return { status: 400, detail: `Paramètre ${name} invalide.` };
    }
  }
  if ((query.from && !DAY_RE.test(query.from)) || (query.to && !DAY_RE.test(query.to))) {
    return { status: 400, detail: 'from et to doivent être au format AAAA-MM-JJ.' };
  }

  const match = {};
  if (user.role === 'CINEMA_ADMIN') {
    const allowed = user.cinemaSlugs ?? [];
    if (query.cinema && !allowed.includes(query.cinema)) {
      return { status: 403, detail: 'Accès refusé à ce cinéma.' };
    }
    match.cinemaSlug = query.cinema ?? { $in: allowed };
  } else if (query.cinema) {
    match.cinemaSlug = query.cinema;
  }
  if (query.movie) match.movieId = query.movie;
  if (query.from || query.to) {
    match.day = {};
    if (query.from) match.day.$gte = query.from;
    if (query.to) match.day.$lte = query.to;
  }
  return { groupBy, match };
}

const SUMS = { booked: { $sum: '$booked' }, cancelled: { $sum: '$cancelled' }, seats: { $sum: '$seats' } };
const RATE = {
  cancellationRate: { $cond: [{ $gt: ['$booked', 0] }, { $round: [{ $divide: ['$cancelled', '$booked'] }, 4] }, 0] }
};

export function statsPipeline({ groupBy, match }) {
  return [
    { $match: match },
    {
      $facet: {
        rows: [
          { $group: { _id: GROUP_FIELDS[groupBy], ...SUMS } },
          { $sort: { seats: -1, _id: 1 } },
          { $limit: 100 },
          {
            $lookup: {
              from: 'movies',
              let: { movieId: '$_id' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', { $convert: { input: '$$movieId', to: 'objectId', onError: null, onNull: null } }] } } },
                { $project: { _id: 0, title: 1 } }
              ],
              as: 'movie'
            }
          },
          {
            $project: {
              _id: 0,
              key: '$_id',
              label: groupBy === 'movie' ? { $ifNull: [{ $first: '$movie.title' }, '$_id'] } : '$_id',
              booked: 1,
              cancelled: 1,
              seats: 1,
              ...RATE
            }
          }
        ],
        days: [
          { $group: { _id: '$day', ...SUMS } },
          { $sort: { _id: 1 } },
          { $project: { _id: 0, day: '$_id', booked: 1, cancelled: 1, seats: 1, ...RATE } }
        ]
      }
    }
  ];
}

export async function queryBookingStats(params, stats = BookingStat) {
  const [result] = await stats.aggregate(statsPipeline(params));
  return { groupBy: params.groupBy, rows: result?.rows ?? [], days: result?.days ?? [] };
}
