const MUTATING_QUERIES = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete'
];

export function insertOnly(schema, label) {
  const reject = (next) => next(new Error(`${label} est en insertion seule`));
  schema.pre(MUTATING_QUERIES, { document: false, query: true }, function rejectQuery(next) {
    reject(next);
  });
  schema.pre('deleteOne', { document: true, query: false }, function rejectDocDelete(next) {
    reject(next);
  });
  schema.pre('save', function rejectDocUpdate(next) {
    if (this.isNew) {
      return next();
    }
    return reject(next);
  });
  return schema;
}
