import React from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useApprovals } from '../hooks/useApprovals'
import { useStore } from '../store/useStore'
import { Post } from './Post'
import { Shield, AlertCircle } from 'lucide-react'

interface ModQueueProps {
  communityId: string
  creator: string
}

export const ModQueue: React.FC<ModQueueProps> = ({ communityId, creator }) => {
  const { data: community } = useCommunity(communityId, creator)
  const { events } = useStore()
  
  // Get all events for this community
  const communityEvents = events.filter(e => 
    e.tags.some(t => t[0] === 'a' && t[1] === `34550:${creator}:${communityId}`)
  )

  const moderators = community?.moderators || []
  const eventIds = communityEvents.map(e => e.id)
  const { data: approvals = [] } = useApprovals(eventIds, moderators)

  // Pending posts = posts with community tag but no approval from a moderator
  const pendingPosts = communityEvents.filter(e => 
    !approvals.some(a => a.tags.some(t => t[0] === 'e' && t[1] === e.id))
  )

  return (
    <div className="p-4 space-y-6">
      <header className="terminal-border p-4 bg-red-500/10 border-red-500/30">
        <h2 className="text-xl font-bold text-red-500 uppercase flex items-center gap-2">
          <Shield size={24} /> Mod_Queue: c/{communityId}
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1">
          {pendingPosts.length} Entries awaiting authorization
        </p>
      </header>

      {pendingPosts.length === 0 ? (
        <div className="text-center p-12 terminal-border border-dashed opacity-30 italic">
          <AlertCircle size={48} className="mx-auto mb-4" />
          [QUEUE_IS_EMPTY]
        </div>
      ) : (
        <div className="space-y-4">
          {pendingPosts.map(event => (
            <div key={event.id} className="relative">
              <Post 
                event={event} 
                isModerator={moderators.includes(event.pubkey)} 
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
