import React, { useEffect, useState, useMemo } from 'react'
import type { Event } from 'nostr-tools'
import { nostrService } from '../services/nostr'
import { Post } from './Post'
import { useStore } from '../store/useStore'
import { MessageSquare } from 'lucide-react'

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
  const { addEvent } = useStore()

  useEffect(() => {
    let sub: { close: () => void } | undefined

    const fetchThread = async () => {
      setIsLoading(true)
      sub = await nostrService.subscribe(
        [
          { ids: [eventId] },
          { kinds: [1], '#e': [eventId] }
        ],
        (event: Event) => {
          setAllEvents(prev => {
            if (prev.find(e => e.id === event.id)) return prev
            return [...prev, event].sort((a, b) => a.created_at - b.created_at)
          })
          addEvent(event)
        }
      )
      
      setTimeout(() => setIsLoading(false), 2500)
    }

    fetchThread()

    return () => {
      sub?.close()
    }
  }, [eventId, addEvent])

  const threadTree = useMemo(() => {
    const nodes: Record<string, ThreadNode> = {}
    const roots: ThreadNode[] = []

    allEvents.forEach(event => {
      nodes[event.id] = { event, replies: [] }
    })

    allEvents.forEach(event => {
      const eTags = event.tags.filter(t => t[0] === 'e')
      const parentId = eTags.length > 0 ? eTags[eTags.length - 1][1] : null
      
      if (parentId && nodes[parentId] && parentId !== event.id) {
        nodes[parentId].replies.push(nodes[event.id])
      } else if (event.id === eventId || !parentId) {
        if (!roots.find(r => r.event.id === event.id)) {
          roots.push(nodes[event.id])
        }
      }
    })

    return roots
  }, [allEvents, eventId])

  const renderNode = (node: ThreadNode, depth = 0) => {
    return (
      <div key={node.event.id} className="space-y-4">
        <Post 
          event={node.event} 
          isThreadView={depth === 0} 
          opPubkey={rootEvent?.pubkey || threadTree[0]?.event.pubkey} 
        />
        {node.replies.length > 0 && (
          <div className="space-y-4 border-l-2 border-slate-800 ml-4 pl-4">
            {node.replies.map(reply => renderNode(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const mainNode = threadTree.find(n => n.event.id === eventId)

  return (
    <div className="p-4 space-y-6">
      {isLoading && allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-20">
          <div className="w-12 h-12 border-2 border-dashed border-purple-500 rounded-full mb-4 animate-spin-slow" />
          <span className="font-mono text-[10px] uppercase">Tracing_Thread_Tree</span>
        </div>
      ) : mainNode ? (
        renderNode(mainNode)
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
          className="w-full bg-transparent text-slate-200 border border-slate-800 rounded-lg focus:border-purple-500/50 p-3 text-sm resize-none h-24 font-sans placeholder:text-slate-600 mb-3"
          placeholder="Type your response..."
        ></textarea>
        <div className="flex justify-end">
          <button className="terminal-button rounded-lg py-1.5 px-6 shadow-lg shadow-purple-500/20">
            Transmit_Reply
          </button>
        </div>
      </section>
    </div>
  )
}
