// BitTorrent Background Worker
let client = null;

try {
  importScripts('https://cdn.jsdelivr.net/npm/webtorrent@2.8.5/dist/webtorrent.min.js');
  
  if (typeof WebTorrent !== 'undefined') {
    client = new WebTorrent();
  } else {
    throw new Error('WebTorrent is not defined after importScripts');
  }
} catch (err) {
  console.error('[TorrentWorker] Initialization failed:', err);
  self.postMessage({ type: 'ERROR', payload: 'Worker init failed: ' + err.message });
}

const getTorrentMetadata = (torrent) => ({
  infoHash: torrent.infoHash,
  magnetURI: torrent.magnetURI,
  name: torrent.name,
  progress: torrent.progress,
  numPeers: torrent.numPeers,
  files: torrent.files.map(f => ({
    name: f.name,
    length: f.length,
    path: f.path
  }))
});

// SHA-256 Hashing in Worker
async function computeSha256(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await self.crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;
  if (!client && type !== 'HASH_FILE') {
    console.error('[TorrentWorker] Cannot handle message: client not initialized', type);
    return;
  }

  switch (type) {
    case 'HASH_FILE':
      try {
        const hash = await computeSha256(payload.file);
        self.postMessage({ type: 'HASH_READY', payload: { hash, name: payload.name } });
      } catch (err) {
        self.postMessage({ type: 'ERROR', payload: 'Hashing failed: ' + err.message });
      }
      break;

    case 'SEED':
      client.seed(payload.file, { name: payload.name }, (torrent) => {
        self.postMessage({
          type: 'SEED_READY',
          payload: getTorrentMetadata(torrent)
        });
      });
      break;

    case 'ADD':
      client.add(payload.magnetUri, (torrent) => {
        const onReady = () => {
          self.postMessage({
            type: 'TORRENT_READY',
            payload: getTorrentMetadata(torrent)
          });
        };

        if (torrent.ready) {
          onReady();
        } else {
          torrent.once('ready', onReady);
        }

        self.postMessage({
          type: 'TORRENT_ADDED',
          payload: {
            infoHash: torrent.infoHash,
            magnetURI: torrent.magnetURI
          }
        });
      });
      break;

    case 'PRIORITIZE':
      const tToPrioritize = client.get(payload.infoHash);
      if (tToPrioritize) {
        const file = tToPrioritize.files[0];
        if (file) {
          file.select(payload.start, payload.end, 1);
        }
      }
      break;

    case 'REMOVE':
      const torrent = client.get(payload.magnetUri);
      if (torrent) {
        torrent.destroy();
      }
      break;

    default:
      console.warn('[TorrentWorker] Unknown message type:', type);
  }
};

// Periodic health updates
setInterval(() => {
  if (!client || client.torrents.length === 0) return;

  const reports = client.torrents.map(t => ({
    infoHash: t.infoHash,
    peerCount: t.numPeers,
    progress: t.progress
  }));

  self.postMessage({
    type: 'HEALTH_UPDATE',
    payload: { reports }
  });
}, 5000);

if (client) {
  client.on('error', (err) => {
    self.postMessage({ type: 'ERROR', payload: err.message });
  });
}