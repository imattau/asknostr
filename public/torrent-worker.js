// BitTorrent Background Worker
let client = null;

try {
  // Absolute, space-free URL for WebTorrent
  importScripts('https://unpkg.com/webtorrent@2.8.5/dist/webtorrent.min.js');
  
  if (typeof WebTorrent !== 'undefined') {
    client = new WebTorrent();
  } else {
    throw new Error('WebTorrent_Not_Found');
  }
} catch (err) {
  console.error('[TorrentWorker] Critical_Init_Error:', err);
}

const getTorrentMetadata = (torrent) => ({
  infoHash: torrent.infoHash,
  magnetURI: torrent.magnetURI,
  name: torrent.name,
  progress: torrent.progress,
  numPeers: torrent.numPeers,
  files: (torrent.files || []).map(f => ({
    name: f.name,
    length: f.length,
    path: f.path
  }))
});

async function computeSha256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await self.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;
  if (!client && type !== 'HASH_FILE') return;

  switch (type) {
    case 'HASH_FILE':
      try {
        const hash = await computeSha256(payload.file);
        self.postMessage({ type: 'HASH_READY', payload: { hash, name: payload.name } });
      } catch (err) {
        self.postMessage({ type: 'ERROR', payload: 'Hashing_Failed' });
      }
      break;

    case 'SEED':
      client.seed(payload.file, { name: payload.name }, (torrent) => {
        self.postMessage({ type: 'SEED_READY', payload: getTorrentMetadata(torrent) });
      });
      break;

    case 'ADD':
      client.add(payload.magnetUri, (torrent) => {
        const onReady = () => {
          self.postMessage({ type: 'TORRENT_READY', payload: getTorrentMetadata(torrent) });
        };
        if (torrent.ready) onReady();
        else torrent.once('ready', onReady);
        self.postMessage({ type: 'TORRENT_ADDED', payload: { infoHash: torrent.infoHash, magnetURI: torrent.magnetURI } });
      });
      break;

    case 'PRIORITIZE':
      const t = client.get(payload.infoHash);
      if (t && t.files[0]) t.files[0].select(payload.start, payload.end, 1);
      break;

    case 'REMOVE':
      const tr = client.get(payload.magnetUri);
      if (tr) tr.destroy();
      break;
  }
};

setInterval(() => {
  if (!client || !client.torrents || client.torrents.length === 0) return;
  const reports = client.torrents.map(t => ({
    infoHash: t.infoHash,
    peerCount: t.numPeers,
    progress: t.progress
  }));
  self.postMessage({ type: 'HEALTH_UPDATE', payload: { reports } });
}, 5000);