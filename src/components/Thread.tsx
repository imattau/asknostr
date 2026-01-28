import { useEffect, useState, useMemo } from 'react'
import type { Event } from 'nostr-tools'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { Post } from './Post'
import { useStore } from '../store/useStore'
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
  const [allEvents, setAllEvents] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { addEvent, user } = useStore()

  const deriveRootId = (fallbackId: string, source?: Event) => {
    if (!source) return fallbackId
    const eTags = source.tags.filter(t => t[0] === 'e')
    const rootTag = eTags.find(t => t[3] === 'root')
    if (rootTag?.[1]) return rootTag[1]
    if (eTags.length > 0) return eTags[0][1]
    return fallbackId
  }

  const rootId = useMemo(() => deriveRootId(eventId, rootEvent), [eventId, rootEvent])
  const rootPubkey = useMemo(() => {
    return allEvents.find(e => e.id === rootId)?.pubkey || rootEvent?.pubkey || ''
  }, [allEvents, rootId, rootEvent])

  useEffect(() => {
    let sub: { close: () => void } | undefined
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    setAllEvents([])

    const fetchThread = async () => {
      console.log('[Thread] Fetching events for ID:', eventId)
      setIsLoading(true)
      
      sub = await nostrService.subscribe(
        [
          { ids: [rootId, eventId] },
          { kinds: [1], '#e': [rootId] },
          { kinds: [1], '#e': [eventId] }
        ],
        (event: Event) => {
          console.log('[Thread] Event received:', event.id, 'kind:', event.kind)
          setAllEvents(prev => {
            if (prev.find(e => e.id === event.id)) return prev
            const next = [...prev, event].sort((a, b) => a.created_at - b.created_at)
            return next
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
  }, [eventId, rootId, addEvent])

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
      const parentPubkey = allEvents.find(e => e.id === parentId)?.pubkey || rootEvent?.pubkey || ''
      
      const tags: string[][] = [
        ['e', rootId, '', 'root'],
        ['e', parentId, '', 'reply']
      ]

      const pTags = new Set<string>()
      if (rootPubkey) pTags.add(rootPubkey)
      if (parentPubkey) pTags.add(parentPubkey)
      pTags.forEach(pubkey => tags.push(['p', pubkey]))

      // Inherit community context if present
      const communityTag = rootEvent?.tags.find(t => t[0] === 'a' && t[1].startsWith('34550:'))
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
    const roots: ThreadNode[] = []

    allEvents.forEach(event => {
      nodes[event.id] = { event, replies: [] }
    })

    allEvents.forEach(event => {
      const eTags = event.tags.filter(t => t[0] === 'e')
      // NIP-10: 'reply' marker or last 'e' tag
      const replyTag = eTags.find(t => t[3] === 'reply') || (eTags.length > 1 ? eTags[eTags.length - 1] : null)
      const rootTag = eTags.find(t => t[3] === 'root') || (eTags.length > 0 ? eTags[0] : null)
      
      const parentId = replyTag ? replyTag[1] : (rootTag && rootTag[1] !== event.id ? rootTag[1] : null)
      
      if (parentId && nodes[parentId] && parentId !== event.id) {
        nodes[parentId].replies.push(nodes[event.id])
      } else {
        // If no parent or parent not found, and it's either the requested event or has no e-tags
        if (event.id === rootId || (eTags.length === 0)) {
          if (!roots.find(r => r.event.id === event.id)) {
            roots.push(nodes[event.id])
          }
        }
      }
    })

    return roots
  }, [allEvents, rootId])

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

  // Fallback if mainNode not found but we have events
  const displayNodes = useMemo(() => {
    const main = threadTree.find(n => n.event.id === eventId)
    if (main) return [main]
    // Show all roots if specific ID not found yet
    return threadTree
  }, [threadTree, eventId])

  return (
    <div className="p-4 space-y-6 pb-32">
      {isLoading && allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
          <RefreshCw size={32} className="animate-spin text-purple-500 mb-4" />
          <span className="font-mono text-[10px] uppercase">Tracing_Thread_Tree</span>
        </div>
      ) : (
        <div className="space-y-6">
          {displayNodes.map(node => renderNode(node))}
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
        <div className="flex justify-end">
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
