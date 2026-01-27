import React, { useEffect, useState } from 'react'
import type { Event } from 'nostr-tools'
import { nostrService } from '../services/nostr'
import { Post } from './Post'
import { useStore } from '../store/useStore'

interface ThreadProps {
  eventId: string
  rootEvent?: Event
}

export const Thread: React.FC<ThreadProps> = ({ eventId, rootEvent }) => {
  const [replies, setReplies] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { addEvent } = useStore()

  useEffect(() => {
    let sub: { close: () => void } | undefined

    const fetchReplies = async () => {
      setIsLoading(true)
      sub = await nostrService.subscribe(
        [{ kinds: [1], '#e': [eventId] }],
        (event: Event) => {
          setReplies(prev => {
            if (prev.find(e => e.id === event.id)) return prev
            return [...prev, event].sort((a, b) => a.created_at - b.created_at)
          })
          addEvent(event) // Add to global store as well
        }
      )
      
      // Assume basic fetch done after 2s for UI state
      setTimeout(() => setIsLoading(false), 2000)
    }

    fetchReplies()

    return () => {
      sub?.close()
    }
  }, [eventId, addEvent])

  return (
    <div className="p-4 space-y-6">
      {/* The Focused Post */}
      <section>
        <h3 className="text-[10px] uppercase font-bold opacity-30 mb-2">Primary_Entry</h3>
        {rootEvent ? (
          <Post event={rootEvent} isThreadView={true} />
        ) : (
          <div className="terminal-border p-8 text-center animate-pulse opacity-50">
            [RETRIEVING_ROOT_EVENT...]
          </div>
        )}
      </section>

      {/* Replies */}
      <section className="space-y-4">
        <h3 className="text-[10px] uppercase font-bold opacity-30 mb-2 flex items-center gap-2">
          Replies_({replies.length}) {isLoading && <span className="animate-spin text-[#00ff41]">/</span>}
        </h3>
        {replies.length === 0 && !isLoading ? (
          <div className="p-8 text-center border border-dashed border-[#00ff41]/20 opacity-30 text-xs">
            [NO_REPLIES_FOUND_ON_NETWORK]
          </div>
        ) : (
          <div className="space-y-4 border-l-2 border-[#00ff41]/10 ml-2 pl-4">
            {replies.map(reply => (
              <Post key={reply.id} event={reply} />
            ))}
          </div>
        )}
      </section>
      
      {/* Quick Reply Box */}
      <section className="terminal-border p-4 bg-[#00ff41]/5">
        <h4 className="text-[10px] uppercase font-bold opacity-50 mb-2">Quick_Reply</h4>
        <textarea 
          className="w-full terminal-input min-h-[60px] text-xs resize-none mb-2"
          placeholder="Append to this thread..."
        ></textarea>
        <div className="flex justify-end">
          <button className="terminal-button text-[10px] py-1 px-4">
            Transmit
          </button>
        </div>
      </section>
    </div>
  )
}
