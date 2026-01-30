// BitTorrent Background Worker
importScripts('https://cdn.jsdelivr.net/npm/webtorrent@2.8.5/dist/webtorrent.min.js');

const client = new WebTorrent();

self.onmessage = (e) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'SEED':
      client.seed(payload.file, { name: payload.name }, (torrent) => {
        self.postMessage({
          type: 'SEED_READY',
          payload: {
            infoHash: torrent.infoHash,
            magnetURI: torrent.magnetURI,
            name: payload.name
          }
        });
      });
      break;

    case 'ADD':
      client.add(payload.magnetUri, (torrent) => {
        self.postMessage({
          type: 'TORRENT_ADDED',
          payload: {
            infoHash: torrent.infoHash,
            magnetURI: torrent.magnetURI
          }
        });
      });
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
