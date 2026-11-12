// Adapted from WhiskeySockets/Baileys PR #2765 for the installed Baileys version.
// (doryani-ai), reviewed at commit 042fe1f. See README.md.
import { randomBytes } from 'node:crypto';

export function tracePairing(stage, details = {}) {
  if (process.env.LOCAL_PAIRING_DIAGNOSTICS !== '1') return;
  const record = { at: new Date().toISOString(), stage };
  if (typeof details.registered === 'boolean') record.registered = details.registered;
  if (Number.isFinite(details.refs)) record.refs = details.refs;
  if (Number.isFinite(details.reason)) record.reason = details.reason;
  console.info('LOCAL_PAIRING ' + JSON.stringify(record));
}

export function makePairingQRRenderer(refs, render) {
  let index = 0, current;
  return {
    next() {
      if (index >= refs.length) return false;
      current = refs[index++];
      render(current);
      return true;
    },
    refresh() {
      if (current === undefined) return false;
      render(current);
      return true;
    }
  };
}

export function handleCompanionRegRefresh(node, { creds, emitCredsUpdate, refreshQR, logger }) {
  if (node?.tag !== 'notification' || node.attrs?.type !== 'companion_reg_refresh' ||
      !Array.isArray(node.content) || !node.content.some(child =>
        ['companion_reg_refresh', 'pair-device-rotate-qr'].includes(child?.tag))) {
    logger.warn('Ignoring malformed companion registration refresh');
    return 'ignored_malformed';
  }
  // Pair-success and pairing-code flows set me. Preserve their shared secret.
  if (creds.me) return 'ignored_registered';
  creds.advSecretKey = randomBytes(32).toString('base64');
  emitCredsUpdate({ advSecretKey: creds.advSecretKey });
  logger.info('Refreshed pairing registration; updating QR');
  refreshQR();
  return 'rotated';
}
