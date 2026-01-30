import React, { useState, useRef } from 'react'
import { Paperclip, Loader2, Share2 } from 'lucide-react'
import { MentionsInput, Mention } from 'react-mentions'
import { nip19, type Event } from 'nostr-tools'
import { nostrService } from '../services/nostr'
import { mediaService } from '../services/mediaService'
import { torrentService } from '../services/torrentService'

const mentionStyle = {
  control: {
    backgroundColor: 'transparent',
    fontSize: 14,
    lineHeight: '1.5rem',
    fontFamily: 'inherit',
  },
  '&multiLine': {
    control: {
      minHeight: 64,
    },
    highlighter: {
      padding: 0,
      border: 'none',
    },
    input: {
      padding: 0,
      margin: 0,
      border: 'none',
      outline: 'none',
      color: 'inherit',
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border-slate)',
      fontSize: 12,
      borderRadius: 12,
      overflow: 'hidden',
    },
    item: {
      padding: '8px 12px',
      borderBottom: '1px solid var(--border-slate)',
      color: 'var(--muted)',
      '&focused': {
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: 'var(--accent-cyan)',
      },
    },
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HashtagTextarea = ({ value, onChange, placeholder, disabled, onUserSearch }: any) => {
  return (
    <div className="relative w-full min-h-[4rem] mt-3 font-sans text-sm leading-6">
      <MentionsInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={mentionStyle}
        classNames={{
          input: 'focus:ring-0 w-full',
        }}
      >
        <Mention
          trigger="@"
          data={onUserSearch}
          displayTransform={(_id: string, display: string) => `@${display}`}
          markup="nostr:[id]"
          className="text-cyan-400 font-bold bg-cyan-500/10 px-0.5 rounded"
          appendSpaceOnAdd
        />
        <Mention
          trigger="#"
          data={(query: string) => [{ id: query, display: query }]}
          displayTransform={(_id: string, display: string) => `#${display}`}
          markup="#[id]"
          className="text-purple-400 font-bold bg-purple-500/10 px-0.5 rounded"
          appendSpaceOnAdd
        />
      </MentionsInput>
    </div>
  )
}

interface FeedComposerProps {
  user: { pubkey: string | null; profile: any | null }
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  isHidden: boolean
}

export const FeedComposer: React.FC<FeedComposerProps> = ({ user, collapsed, setCollapsed, isHidden }) => {
  const [postContent, setPostContent] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [isNsfw, setIsNsfw] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [pendingFallbackUrl, setPendingFallbackUrl] = useState<string | undefined>()
  const [pendingMagnet, setPendingMagnet] = useState<string | undefined>()
  const [pendingFile, setPendingFile] = useState<File | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const torrentInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingMedia(true)
    try {
      const url = await mediaService.uploadFile(file)
      setPostContent(prev => prev ? `${prev}\n${url}` : url)
    } catch (err) {
      console.error('Upload failed', err)
      alert(err instanceof Error ? err.message : 'Failed to upload media')
    } finally {
      setIsUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleTorrentSeed = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsSeeding(true)
    try {
      const { magnet, fallbackUrl } = await torrentService.prepareDualUpload(file, user.pubkey || '')
      setPostContent(prev => prev ? `${prev}\n${magnet}` : magnet)
      setPendingFile(file)
      setPendingMagnet(magnet)
      if (fallbackUrl) setPendingFallbackUrl(fallbackUrl)
    } catch (err) {
      console.error('Seeding preparation failed', err)
      alert(err instanceof Error ? err.message : 'Failed to seed file')
    } finally {
      setIsSeeding(false)
      if (torrentInputRef.current) torrentInputRef.current.value = ''
    }
  }

  const handlePublish = async () => {
    if (!postContent.trim() || !user.pubkey) return
    setIsPublishing(true)
    console.log('[FeedComposer] Initiating publication...')
    try {
      const tags: string[][] = []
      if (isNsfw) tags.push(['content-warning', 'nsfw'])
      if (pendingFallbackUrl) {
        tags.push(['url', pendingFallbackUrl])
      }
      
      const magnetToCommit = pendingMagnet || postContent.match(/magnet:\?xt=urn:btih:([a-zA-Z0-9]+)/i)?.[0]
      if (magnetToCommit) {
        const infoHashMatch = magnetToCommit.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
        if (infoHashMatch) {
          tags.push(['magnet', magnetToCommit])
          tags.push(['i', infoHashMatch[1].toLowerCase()])
        }
      }

      // Extract hashtags from #[tag] markup
      const hashtags = postContent.match(/#\[(\w+)\]/g)
      if (hashtags) {
        hashtags.forEach(match => {
          const tag = match.slice(2, -1).toLowerCase()
          if (!tags.some(t => t[0] === 't' && t[1] === tag)) {
            tags.push(['t', tag])
          }
        })
      }

      // Extract Mentions from nostr:[npub1...] markup
      const mentionRegex = /nostr:\[(npub1[a-z0-9]+|nprofile1[a-z0-9]+)\]/gi
      const mentions = postContent.match(mentionRegex)
      if (mentions) {
        mentions.forEach(m => {
          try {
            const entity = m.slice(7, -1) // remove nostr:[ and ]
            const decoded = nip19.decode(entity)
            if (decoded.type === 'npub') {
              tags.push(['p', decoded.data as string])
            } else if (decoded.type === 'nprofile') {
              tags.push(['p', (decoded.data as any).pubkey])
            }
          } catch (e) {
            // Ignore
          }
        })
      }

      const cleanContent = postContent
        .replace(/#\[(\w+)\]/g, '#$1')
        .replace(/nostr:\[(npub1[a-z0-9]+|nprofile1[a-z0-9]+)\]/gi, 'nostr:$1')

      const success = await nostrService.createAndPublishPost(cleanContent, tags)
      
      if (success) {
        console.log('[FeedComposer] Publication success! Finalizing torrent transaction...')
        if (pendingFile && pendingMagnet) {
          await torrentService.finalizePublication(pendingFile, pendingMagnet, pendingFallbackUrl, user.pubkey)
        }
        setPostContent('')
        setIsNsfw(false)
        setPendingFallbackUrl(undefined)
        setPendingFile(undefined)
        setPendingMagnet(undefined)
      } else {
        alert('Publication failed. Relays might be unreachable.')
      }
    } catch (e) {
      console.error('[FeedComposer] Publication error:', e)
      alert('Failed to publish post. Check connection.')
    } finally {
      setIsPublishing(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleUserSearch = async (query: string, callback: any) => {
    if (query.length < 2) return
    const sub = await nostrService.subscribe(
      [{ kinds: [0], search: query, limit: 10 }],
      (event: Event) => {
        try {
          const profile = JSON.parse(event.content)
          callback([
            {
              id: nip19.npubEncode(event.pubkey),
              display: profile.display_name || profile.name || event.pubkey.slice(0, 8)
            }
          ])
        } catch (e) {
          // ignore
        }
      },
      nostrService.getSearchRelays()
    )
    setTimeout(() => sub.close(), 2000)
  }

  return (
    <div className={`mx-4 mb-2 transition-all duration-300 ease-in-out overflow-hidden ${isHidden ? 'max-h-0 opacity-0 mb-0' : 'max-h-96 opacity-100'}`}>
      <div
        className={`glassmorphism rounded-xl border-slate-800 shadow-2xl p-3 transition-all duration-200 ${ 
          collapsed ? 'max-h-0 opacity-0 pointer-events-none hidden' : 'max-h-72 opacity-100 block'
        }`}>
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-slate-400">Broadcast</span>
          <button
            onClick={() => setCollapsed(true)}
            className="text-[10px] uppercase tracking-[0.3em] text-cyan-300 hover:text-cyan-200"
          >
            hide
          </button>
        </div>
        <HashtagTextarea
          value={postContent}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={(e: any) => setPostContent(e.target.value)}
          disabled={!user.pubkey || isPublishing}
          placeholder={user.pubkey ? 'Broadcast to network...' : 'Login to write...'}
          onUserSearch={handleUserSearch}
        />
        <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-3 text-[9px]">
          <label className="flex items-center gap-2 uppercase font-mono text-slate-500">
            <input type="checkbox" checked={isNsfw} onChange={(e) => setIsNsfw(e.target.checked)} className="accent-red-500" /> NSFW
          </label>
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
            <input type="file" ref={torrentInputRef} onChange={handleTorrentSeed} className="hidden" accept="image/*,video/*,audio/*" />
            
            <button type="button" disabled={isUploadingMedia || isSeeding || !user.pubkey} onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 transition-colors disabled:opacity-50" title="Attach Media">
              {isUploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
            </button>

            <button type="button" disabled={isUploadingMedia || isSeeding || !user.pubkey} onClick={() => torrentInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/5 text-purple-400 transition-colors disabled:opacity-50" title="Seed via BitTorrent">
              {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
            </button>

            <button onClick={handlePublish} disabled={!user.pubkey || !postContent.trim() || isPublishing || isSeeding} className="terminal-button rounded-lg text-[10px] py-1 px-3">Transmit</button>
          </div>
        </div>
      </div>
      <div className={`glassmorphism rounded-full shadow-inner px-4 py-1 text-[9px] uppercase tracking-[0.3em] text-cyan-300/60 text-center cursor-pointer transition-all duration-300 hover:text-cyan-200 hover:bg-white/10 ${collapsed ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none h-0 py-0 overflow-hidden'}`} onClick={() => setCollapsed(false)}>Open composer</div>
    </div>
  )
}
