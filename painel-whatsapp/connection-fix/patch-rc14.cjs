'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2];
if(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version!=='7.0.0-rc14')throw Error('Unsupported Baileys version');
function replaceOnce(text,before,after){if(text.split(before).length!==2)throw Error('Patch context differs');return text.replace(before,after);}
function checkedFile(name,hash){const file=path.join(root,'lib/Socket',name),bytes=fs.readFileSync(file);if(crypto.createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Unexpected source: '+name);return {file,text:bytes.toString('utf8')};}
const socket=checkedFile('socket.js','ff8b19ff02491fa080ee371f066d49c94acb903207dd0d9fdb5548e5a594fb4a');
const recv=checkedFile('messages-recv.js','850445e6f9e076b1beb98034cbc5cf79562dfda26a44f5a874a84e3609bfd710');
let s="import {makePairingQRRenderer,handleCompanionRegRefresh,tracePairing} from '../Utils/pairing-refresh.mjs';\n"+socket.text;
s=replaceOnce(s,'    // QR gen\n','    let refreshPairingQR;\n    // QR gen\n');
s=replaceOnce(s,'        const advB64 = creds.advSecretKey;',`        tracePairing('qr-flow', { refs: refNodes.length, registered: !!creds.me });
        const renderer = makePairingQRRenderer(
            refNodes.map(node => node.content.toString('utf-8')),
            ref => {
                tracePairing('qr-render');
                ev.emit('connection.update', { qr: buildPairingQRData(ref, noiseKeyB64, identityKeyB64, creds.advSecretKey, browser) });
            }
        );
        refreshPairingQR = () => renderer.refresh();`);
s=replaceOnce(s,`            const refNode = refNodes.shift();
            if (!refNode) {`,'            if (!renderer.next()) {');
s=replaceOnce(s,`            const ref = refNode.content.toString('utf-8');
            const qr = buildPairingQRData(ref, noiseKeyB64, identityKeyB64, advB64, browser);
            ev.emit('connection.update', { qr });
`,'');
s=replaceOnce(s,'    // device paired for the first time\n',`    ws.on('CB:notification,type:companion_reg_refresh', node => {
        const outcome = handleCompanionRegRefresh(node, {
            creds, logger,
            emitCredsUpdate: update => ev.emit('creds.update', update),
            refreshQR: () => refreshPairingQR?.()
        });
        tracePairing(outcome, { registered: !!creds.me });
    });
    // device paired for the first time
`);
s=replaceOnce(s,"        logger.debug('pair success recv');","        tracePairing('pair-success');\n        logger.debug('pair success recv');");
s=replaceOnce(s,"        ev.emit('connection.update', { connection: 'open' });","        tracePairing('open');\n        ev.emit('connection.update', { connection: 'open' });");
s=replaceOnce(s,"        const reason = +(node.attrs.reason || 500);","        const reason = +(node.attrs.reason || 500);\n        tracePairing('server-failure', { reason });");
s=replaceOnce(s,"        const { reason, statusCode } = getErrorCodeFromStreamError(node);","        const { reason, statusCode } = getErrorCodeFromStreamError(node);\n        tracePairing('stream-error', { reason: statusCode });");
let r=replaceOnce(recv.text,"                const linkCodeCompanionReg = getBinaryNodeChild(node, 'link_code_companion_reg');","                const linkCodeCompanionReg = getBinaryNodeChild(node, 'link_code_companion_reg');\n                if (!linkCodeCompanionReg || !getBinaryNodeChildBuffer(linkCodeCompanionReg, 'primary_identity_pub')) break;");
r=replaceOnce(r,'        const stanza = buildAckStanza(node, errorCode, authState.creds.me.id);',`        const meId = authState.creds.me?.id;
        if (node.tag === 'message' && !meId) throw new Boom('Cannot ack a message before login');
        const stanza = buildAckStanza(node, errorCode, meId);`);
fs.copyFileSync(path.join(__dirname,'pairing-refresh.mjs'),path.join(root,'lib/Utils/pairing-refresh.mjs'));
fs.writeFileSync(socket.file,s);fs.writeFileSync(recv.file,r);
console.log('Applied reviewed registration/ACK guards to official Baileys rc14.');
