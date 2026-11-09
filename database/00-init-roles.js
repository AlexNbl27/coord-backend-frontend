const admin = db.getSiblingDB('admin');
const MASTER_DB = 'cineslot_master';
const LEGACY_DB = 'cours_db';
const TENANT_COLLECTIONS = ['slots', 'bookings'];
const APPEND_ONLY = ['reservation_logs', 'audit_logs'];
const MASTER_RW = ['cinemas', 'users', 'movies', 'booking_stats', 'ab_subjects', 'job_locks'];
const RW = ['find', 'insert', 'update', 'remove', 'createIndex', 'listIndexes', 'createCollection'];

const on = (dbName, collection, actions) => ({ resource: { db: dbName, collection }, actions });
const appendOnly = APPEND_ONLY.map((c) => on(MASTER_DB, c, ['find', 'insert', 'createIndex', 'listIndexes', 'createCollection']));

function upsertRole(role, privileges) {
  if (admin.getRole(role)) {
    admin.updateRole(role, { privileges, roles: [] });
  } else {
    admin.createRole({ role, privileges, roles: [] });
  }
}

function upsertUser(user, envVar, roleNames) {
  const pwd = process.env[envVar];
  if (!pwd) throw new Error(`${envVar} requis`);
  const roles = roleNames.map((role) => ({ role, db: 'admin' }));
  if (admin.getUser(user)) {
    admin.updateUser(user, { pwd, roles });
  } else {
    admin.createUser({ user, pwd, roles });
  }
}

upsertRole('cineslotMasterRole', [
  ...MASTER_RW.map((c) => on(MASTER_DB, c, RW)),
  ...appendOnly,
  on(MASTER_DB, '', ['listCollections']),
  on(LEGACY_DB, '', [...RW, 'listCollections'])
]);

// dropCollection: the J+60 purge job runs on the tenant connection; it adds nothing over remove on the same collections
upsertRole('cineslotTenantRole', TENANT_COLLECTIONS.map((c) => on('', c, [...RW, 'dropCollection'])));

upsertRole('cineslotPurgeRole', [
  on(MASTER_DB, 'cinemas', ['find', 'update']),
  ...appendOnly,
  ...TENANT_COLLECTIONS.map((c) => on('', c, ['find', 'remove', 'dropCollection']))
]);

upsertUser('cineslotMaster', 'MONGO_MASTER_PASSWORD', ['cineslotMasterRole']);
upsertUser('cineslotTenant', 'MONGO_TENANT_PASSWORD', ['cineslotTenantRole']);
upsertUser('cineslotPurge', 'MONGO_PURGE_PASSWORD', ['cineslotPurgeRole']);
