import { useEffect, useState, useMemo, useRef } from 'react'
import type { Event } from 'nostr-tools'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { Post } from './Post'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'

interface ThreadProps {
  eventId: string
  rootEvent?: Event
}

interface ThreadNode {
  event: Event
  replies: ThreadNode[]
}

export const Thread: React.FC<ThreadProps> = ({ eventId, rootEvent }) => {
  const [allEvents, setAllEvents] = useState<Event[]>(rootEvent ? [rootEvent] : [])
  const [isLoading, setIsLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isNsfw, setIsNsfw] = useState(false)
  const { addEvent, user, events } = useStore()
  const { stack } = useUiStore()
  const containerRef = useRef<HTMLDivElement>(null)

  const currentLayer = stack[stack.length - 1]
  const forceFullThread = (currentLayer?.params as any)?.forceFullThread

  // Auto-scroll to selected reply once loaded
  useEffect(() => {
    if (!isLoading && allEvents.length > 0) {
      // Small delay to ensure render is committed
      const timer = setTimeout(() => {
        const element = containerRef.current?.querySelector(`[data-event-id="${eventId}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoading, allEvents.length, eventId])

  const getETags = (source?: Event) => source?.tags.filter(t => t[0] === 'e') || []

  const deriveRootId = (fallbackId: string, source?: Event) => {
    if (!source) return fallbackId
    const eTags = getETags(source)
    const rootTag = eTags.find(t => t[3] === 'root')
    if (rootTag?.[1]) return rootTag[1]
    if (eTags.length > 0 && eTags[0][1]) return eTags[0][1]
    return fallbackId
  }

  const deriveParentId = (event: Event) => {
    const eTags = getETags(event)
    const hasMarkers = eTags.some(t => t[3])
    const replyTag = eTags.find(t => t[3] === 'reply')
    if (replyTag?.[1]) return replyTag[1]
    if (!hasMarkers) {
      if (eTags.length > 1) return eTags[eTags.length - 1][1]
      if (eTags.length === 1) return eTags[0][1]
    }
    return null
  }

  const sourceEvent = useMemo(() => {
    return rootEvent || events.find(e => e.id === eventId)
  }, [rootEvent, events, eventId])

  const rootId = useMemo(() => deriveRootId(eventId, sourceEvent), [eventId, sourceEvent])

  const rootEventResolved = useMemo(() => {
    return allEvents.find(e => e.id === rootId) || (sourceEvent?.id === rootId ? sourceEvent : undefined)
  }, [allEvents, rootId, sourceEvent])

  const rootPubkey = rootEventResolved?.pubkey || ''

  useEffect(() => {
    let sub: { close: () => void } | undefined
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    
    // Do NOT clear allEvents here if we have a rootEvent, 
    // it causes the "flash to root" behavior.
    if (!rootEvent) {
      setAllEvents([])
    }
    setReplyContent('')
    setIsNsfw(false)

    const fetchThread = async () => {
      console.log('[Thread] Fetching events for ID:', eventId, 'Root:', rootId)
      setIsLoading(true)
      
      const gatheredIds = new Set<string>([rootId, eventId])
      const eTagIds = getETags(sourceEvent).map(t => t[1]).filter(Boolean)
      eTagIds.forEach(id => gatheredIds.add(id))

      const subscribeToIds = async (ids: string[]) => {
        return await nostrService.subscribe(
          [
            { ids },
            { kinds: [1], '#e': ids }
          ],
          (event: Event) => {
            setAllEvents(prev => {
              if (prev.find(e => e.id === event.id)) return prev
              
              // New discovery: check if this event has parents we don't know about
              const newParentIds = getETags(event)
                .map(t => t[1])
                .filter(id => id && !gatheredIds.has(id))
              
              if (newParentIds.length > 0) {
                newParentIds.forEach(id => gatheredIds.add(id))
                subscribeToIds(newParentIds) // Recursive discovery
              }

              return [...prev, event].sort((a, b) => a.created_at - b.created_at)
            })
            addEvent(event)
          },
          undefined,
          {
            onEose: () => {
              if (resolved) return
              resolved = true
              if (timeoutId) clearTimeout(timeoutId)
              setIsLoading(false)
            }
          }
        )
      }

      sub = await subscribeToIds(Array.from(gatheredIds))
      
      timeoutId = setTimeout(() => {
        if (resolved) return
        resolved = true
        console.log('[Thread] Fetch timeout reached.')
        setIsLoading(false)
      }, 3500)
    }

    fetchThread()

    return () => {
      console.log('[Thread] Closing subscription')
      if (timeoutId) clearTimeout(timeoutId)
      sub?.close()
    }
  }, [eventId, rootId, addEvent, sourceEvent])

  const handleReply = async () => {
    console.log('[Thread] handleReply initiated')
    if (!replyContent.trim()) {
      console.warn('[Thread] Empty content, aborting')
      return
    }
    if (!user.pubkey) {
      console.warn('[Thread] No user pubkey, aborting')
      alert('Login required to reply.')
      return
    }

    setIsSubmitting(true)
    triggerHaptic(10)

    try {
      const now = Math.floor(Date.now() / 1000)
      const parentId = eventId
      const parentPubkey = allEvents.find(e => e.id === parentId)?.pubkey || rootEventResolved?.pubkey || ''
      
      const tags: string[][] = []
      if (rootId) tags.push(['e', rootId, '', 'root'])
      if (parentId) tags.push(['e', parentId, '', 'reply'])
      if (isNsfw) tags.push(['content-warning', 'nsfw'])

      const pTags = new Set<string>()
      if (rootPubkey) pTags.add(rootPubkey)
      if (parentPubkey) pTags.add(parentPubkey)
      pTags.forEach(pubkey => tags.push(['p', pubkey]))

      // Inherit community context if present
      const communityTag = rootEventResolved?.tags.find(t => t[0] === 'a' && t[1].startsWith('34550:'))
      if (communityTag) {
        console.log('[Thread] Inheriting community tag:', communityTag[1])
        tags.push(communityTag)
      }

      const eventTemplate = {
        kind: 1,
        created_at: now,
        tags,
        content: replyContent,
      }

      console.log('[Thread] Requesting signature for template:', eventTemplate)
      const signedEvent = await signerService.signEvent(eventTemplate)
      console.log('[Thread] Event signed successfully:', signedEvent.id)
      
      const success = await nostrService.publish(signedEvent)
      
      if (success) {
        console.log('[Thread] Broadcast success')
        setReplyContent('')
        setIsNsfw(false)
        // Optimistically update UI
        setAllEvents(prev => {
          const next = [...prev, signedEvent]
          return next.sort((a, b) => a.created_at - b.created_at)
        })
        addEvent(signedEvent)
        triggerHaptic(50)
      } else {
        console.warn('[Thread] Broadcast failed on all relays')
        alert('Reply signed but failed to broadcast to any relays. It may not be visible to others.')
        // Still add locally so user doesn't lose data?
        setAllEvents(prev => [...prev, signedEvent])
        addEvent(signedEvent)
      }
    } catch (e) {
      console.error('[Thread] Reply failed:', e)
      alert(`Failed to transmit reply: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const threadTree = useMemo(() => {
    const nodes: Record<string, ThreadNode> = {}
    
    allEvents.forEach(event => {
      nodes[event.id] = { event, replies: [] }
    })

    allEvents.forEach(event => {
      const parentId = deriveParentId(event)
      if (parentId && nodes[parentId] && parentId !== event.id) {
        nodes[parentId].replies.push(nodes[event.id])
      }
    })

    // Find the node corresponding to our requested branch
    const targetId = forceFullThread ? rootId : eventId
    const targetNode = nodes[targetId]
    
    // If we have the target (root or comment), return it.
    // However, if we are in forceFullThread mode, we also want to return any 
    // "orphan" nodes that point to this root but haven't linked yet.
    if (targetNode) {
      if (!forceFullThread) return [targetNode]
      
      // Full thread mode: return root + orphans that point to it
      const results = [targetNode]
      Object.values(nodes).forEach(node => {
        if (node.event.id === targetId) return
        const parentId = deriveParentId(node.event)
        // If it's an orphan (parent not in nodes) but it belongs to this thread root
        const isOrphan = !parentId || !nodes[parentId]
        const referencesRoot = node.event.tags.some(t => t[0] === 'e' && t[1] === rootId)
        
        if (isOrphan && referencesRoot && !results.includes(node)) {
          results.push(node)
        }
      })
      return results
    }

    // Fallback: If root isn't discovered yet, show all "orphans"
    return Object.values(nodes).filter(node => {
      const parentId = deriveParentId(node.event)
      return !parentId || !nodes[parentId]
    })
  }, [allEvents, eventId, rootId, forceFullThread])

  const renderNode = (node: ThreadNode, depth = 0) => {
    return (
      <div key={node.event.id} className="space-y-4">
        <Post 
          event={node.event} 
          isThreadView={depth === 0} 
          opPubkey={rootPubkey || threadTree[0]?.event.pubkey} 
        />
        {node.replies.length > 0 && (
          <div className="space-y-4 border-l-2 border-slate-800 ml-4 pl-4 mt-4">
            {node.replies.sort((a,b) => a.event.created_at - b.event.created_at).map(reply => renderNode(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="p-4 space-y-6 pb-32">
      {isLoading && allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
          <RefreshCw size={32} className="animate-spin text-purple-500 mb-4" />
          <span className="font-mono text-[10px] uppercase">Tracing_Thread_Tree</span>
        </div>
      ) : (
        <div className="space-y-6">
          {threadTree.map(node => renderNode(node))}
        </div>
      )}
      
      <section className="glassmorphism p-4 rounded-xl border-purple-500/20 bg-purple-500/5 mt-8">
        <h4 className="flex items-center gap-2 font-mono font-bold text-[10px] text-purple-400 uppercase mb-3 tracking-widest">
          <MessageSquare size={14} /> Append_To_Thread
        </h4>
        <textarea 
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          disabled={!user.pubkey || isSubmitting}
          className="w-full bg-transparent text-slate-200 border border-slate-800 rounded-lg focus:border-purple-500/50 p-3 text-sm resize-none h-24 font-sans placeholder:text-slate-600 mb-3 disabled:opacity-50"
          placeholder={user.pubkey ? "Type your response..." : "Login required to participate in thread."}
        ></textarea>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-[9px] font-mono uppercase text-slate-500">
            <input
              type="checkbox"
              checked={isNsfw}
              onChange={(e) => setIsNsfw(e.target.checked)}
              className="accent-red-500"
            />
            NSFW
          </label>
          <button 
            onClick={handleReply}
            disabled={!user.pubkey || !replyContent.trim() || isSubmitting}
            className="terminal-button rounded-lg py-1.5 px-6 shadow-lg shadow-purple-500/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Transmitting...' : 'Transmit_Reply'}
          </button>
        </div>
      </section>
    </div>
  )
}
