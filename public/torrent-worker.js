// BitTorrent Background Worker
// Using a more robust CDN URL format
importScripts('https://cdn.jsdelivr.net/npm/webtorrent/dist/webtorrent.min.js');

const client = new WebTorrent();

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
  if (client.torrents.length === 0) return;

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

client.on('error', (err) => {
  self.postMessage({ type: 'ERROR', payload: err.message });
});
