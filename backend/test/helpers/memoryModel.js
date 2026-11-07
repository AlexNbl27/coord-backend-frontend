const getPath = (doc, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), doc);

function matchValue(value, cond) {
  if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, arg]) => {
      if (op === '$in') return arg.includes(value);
      if (op === '$gte') return value >= arg;
      if (op === '$lte') return value <= arg;
      if (op === '$eq') return value === arg;
      throw new Error(`unsupported operator ${op}`);
    });
  }
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  return value === cond;
}

const matches = (doc, filter = {}) => Object.entries(filter).every(([k, c]) => matchValue(getPath(doc, k), c));

function compare(sort) {
  return (a, b) => {
    for (const [k, dir] of Object.entries(sort)) {
      const x = getPath(a, k);
      const y = getPath(b, k);
      if (x < y) return -dir;
      if (x > y) return dir;
    }
    return 0;
  };
}

class Query {
  constructor(run) {
    this.run = run;
    this.opts = { sort: null, skip: 0, limit: Infinity };
  }
  sort(s) { this.opts.sort = s; return this; }
  skip(n) { this.opts.skip = n; return this; }
  limit(n) { this.opts.limit = n; return this; }
  select() { return this; }
  lean() { return this; }
  then(resolve, reject) {
    return Promise.resolve().then(() => this.run(this.opts)).then(resolve, reject);
  }
}

export function createMemoryModel({ unique = [] } = {}) {
  const docs = [];
  let nextId = 1;
  const clone = (d) => structuredClone(d);
  const select = (filter, { sort, skip, limit }) => {
    let out = docs.filter((d) => matches(d, filter));
    if (sort) out = out.sort(compare(sort));
    return out.slice(skip, skip + limit).map(clone);
  };
  return {
    docs,
    queries: [],
    async create(doc) {
      for (const key of unique) {
        if (docs.some((d) => d[key] === doc[key])) {
          throw Object.assign(new Error(`E11000 duplicate key ${key}`), { code: 11000 });
        }
      }
      const stored = { _id: `id-${nextId++}`, ...clone(doc) };
      docs.push(stored);
      return clone(stored);
    },
    find(filter = {}) {
      this.queries.push(filter);
      return new Query((opts) => select(filter, opts));
    },
    findOne(filter = {}) {
      return new Query((opts) => select(filter, { ...opts, limit: 1 })[0] ?? null);
    },
    async countDocuments(filter = {}) {
      return docs.filter((d) => matches(d, filter)).length;
    }
  };
}
