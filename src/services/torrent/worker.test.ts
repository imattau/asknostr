import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TorrentWorkerBridge } from './workerBridge'

describe('TorrentWorkerBridge', () => {
  let bridge: TorrentWorkerBridge

  beforeEach(() => {
    vi.clearAllMocks()
    bridge = new TorrentWorkerBridge()
  })

  it('should initialize a Web Worker', () => {
    expect(global.Worker).toHaveBeenCalledWith('/torrent-worker.js', expect.any(Object))
  })

  it('should send a seed command to the worker', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const postMessageSpy = vi.spyOn((bridge as any).worker, 'postMessage')
    
    bridge.seed(file)
    
    expect(postMessageSpy).toHaveBeenCalledWith({
      type: 'SEED',
      payload: { file, name: 'test.txt', type: 'text/plain' }
    })
  })

  it('should send an add command to the worker', async () => {
    const magnet = 'magnet:?xt=urn:btih:abc'
    const postMessageSpy = vi.spyOn((bridge as any).worker, 'postMessage')
    
    bridge.add(magnet)
    
    expect(postMessageSpy).toHaveBeenCalledWith({
      type: 'ADD',
      payload: { magnetUri: magnet }
    })
  })

  it('should send a prioritize command to the worker', () => {
    const infoHash = 'abc'
    const postMessageSpy = vi.spyOn((bridge as any).worker, 'postMessage')
    
    bridge.prioritize(infoHash, 0, 10)
    
    expect(postMessageSpy).toHaveBeenCalledWith({
      type: 'PRIORITIZE',
      payload: { infoHash, start: 0, end: 10 }
    })
  })

  it('should send a remove command to the worker', async () => {
    const magnet = 'magnet:?xt=urn:btih:abc'
    const postMessageSpy = vi.spyOn((bridge as any).worker, 'postMessage')
    
    bridge.remove(magnet)
    
    expect(postMessageSpy).toHaveBeenCalledWith({
      type: 'REMOVE',
      payload: { magnetUri: magnet }
    })
  })

  it('should update local state when SEED_READY is received', async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const seedPromise = bridge.seed(file)
    
    const mockWorker = (bridge as any).worker
    const onmessage = mockWorker.onmessage
    
    onmessage({
      data: {
        type: 'SEED_READY',
        payload: {
          infoHash: 'abc',
          magnetURI: 'magnet:?xt=urn:btih:abc',
          name: 'test.txt'
        }
      }
    })
    
    const result = await seedPromise
    expect(result.infoHash).toBe('abc')
    expect(bridge.get('abc')).toBeDefined()
    expect(bridge.get('abc')?.progress).toBe(1)
  })

  it('should update local state when TORRENT_ADDED is received', async () => {
    const magnet = 'magnet:?xt=urn:btih:def'
    const addPromise = bridge.add(magnet)
    
    const mockWorker = (bridge as any).worker
    const onmessage = mockWorker.onmessage
    
    onmessage({
      data: {
        type: 'TORRENT_ADDED',
        payload: {
          infoHash: 'def',
          magnetURI: magnet
        }
      }
    })
    
    const result = await addPromise
    expect(result.infoHash).toBe('def')
    expect(bridge.get('def')).toBeDefined()
    expect(bridge.get('def')?.progress).toBe(0)
  })

  it('should update health when HEALTH_UPDATE is received', () => {
    // Manually add a torrent to state
    ;(bridge as any).torrents.set('ghi', {
      infoHash: 'ghi',
      magnetURI: 'magnet:?xt=urn:btih:ghi',
      progress: 0,
      numPeers: 0
    })
    
    const mockWorker = (bridge as any).worker
    const onmessage = mockWorker.onmessage
    
    onmessage({
      data: {
        type: 'HEALTH_UPDATE',
        payload: {
          reports: [{
            infoHash: 'ghi',
            progress: 0.5,
            peerCount: 10
          }]
        }
      }
    })
    
    const torrent = bridge.get('ghi')
    expect(torrent?.progress).toBe(0.5)
    expect(torrent?.numPeers).toBe(10)
  })
})
