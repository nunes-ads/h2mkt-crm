'use strict';
function createConnectionQR({ now = Date.now, maxAge = 60000 } = {}) {
  let latest = null, revision = 0;
  return {
    get revision() { return revision; },
    current() { return latest && now() - latest.updatedAt < maxAge ? { ...latest } : null; },
    clear() { latest = null; revision++; },
    update(data) {
      const raw = data?.qrcode?.base64 || data?.base64;
      if (typeof raw !== 'string' || raw.length > 500000) return null;
      const base64 = raw.startsWith('data:') ? raw : 'data:image/png;base64,' + raw;
      if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
      latest = { base64, revision: ++revision, updatedAt: now() };
      return { ...latest };
    }
  };
}
module.exports = { createConnectionQR };
