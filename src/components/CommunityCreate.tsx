import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { Shield, Plus, Info, Globe, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'

const communitySchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  id: z.string().min(3, 'Identifier must be at least 3 characters').regex(/^[a-z0-9-]+$/, 'Lower case letters, numbers and hyphens only'),
  description: z.string().min(10, 'Description should be more descriptive'),
  rules: z.string().optional(),
  image: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  relays: z.string(), // Use string for the input field
})

type CommunityFormData = z.infer<typeof communitySchema>

export const CommunityCreate: React.FC = () => {
  const { user } = useStore()
  const { popLayer } = useUiStore()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CommunityFormData>({
    resolver: zodResolver(communitySchema),
    defaultValues: {
      relays: 'wss://relay.damus.io, wss://nos.lol'
    }
  })

  const onSubmit = async (data: CommunityFormData) => {
    if (!user.pubkey || !window.nostr) {
      alert('Login required to initialize community node.')
      return
    }

    try {
      // eslint-disable-next-line react-hooks/purity
      const now = Math.floor(Date.now() / 1000)
      const relayList = data.relays.split(',').map(r => r.trim()).filter(r => r.startsWith('wss://'))
      
      const eventTemplate = {
        kind: 34550,
        created_at: now,
        tags: [
          ['d', data.id],
          ['name', data.name],
          ['description', data.description],
          ...(data.rules ? [['rules', data.rules]] : []),
          ...(data.image ? [['image', data.image]] : []),
          ...relayList.map(r => ['relay', r]),
          ['p', user.pubkey] // Creator is the first moderator
        ],
        content: '',
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      triggerHaptic(50)
      alert(`Community station ${data.id} successfully initialized.`)
      popLayer()
    } catch (e) {
      console.error('Initialization failed', e)
      alert('Failed to broadcast community definition.')
    }
  }

  return (
    <div className="p-6 space-y-8">
      <header className="terminal-border p-4 bg-purple-500/10 border-purple-500/30">
        <h2 className="text-xl font-bold text-purple-400 uppercase flex items-center gap-2">
          <Shield size={24} /> New_Station_Initialization
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1">
          Establishing a new moderated NIP-72 community node
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Globe size={12} /> Community_Name
            </label>
            <input 
              {...register('name')}
              placeholder="e.g. Nostr Protocol Enthusiasts"
              className="w-full terminal-input rounded-lg"
            />
            {errors.name && <p className="text-red-500 text-[9px] font-mono uppercase">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Info size={12} /> Unique_Identifier (d-tag)
            </label>
            <input 
              {...register('id')}
              placeholder="e.g. nostr-tech"
              className="w-full terminal-input rounded-lg"
            />
            {errors.id && <p className="text-red-500 text-[9px] font-mono uppercase">{errors.id.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <ImageIcon size={12} /> Banner_Image_URL
          </label>
          <input 
            {...register('image')}
            placeholder="https://example.com/banner.png"
            className="w-full terminal-input rounded-lg"
          />
          {errors.image && <p className="text-red-500 text-[9px] font-mono uppercase">{errors.image.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            Station_Description
          </label>
          <textarea 
            {...register('description')}
            placeholder="Define the scope of this community..."
            className="w-full terminal-input rounded-lg min-h-[80px]"
          />
          {errors.description && <p className="text-red-500 text-[9px] font-mono uppercase">{errors.description.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            Community_Directives (Rules)
          </label>
          <textarea 
            {...register('rules')}
            placeholder="[1] No spam. [2] Stay on topic..."
            className="w-full terminal-input rounded-lg min-h-[80px]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <Globe size={12} /> Home_Relays (Comma separated)
          </label>
          <input 
            {...register('relays')}
            placeholder="wss://relay.damus.io, wss://nos.lol"
            className="w-full terminal-input rounded-lg"
          />
          <p className="text-[8px] text-slate-600 font-mono uppercase">Nodes where community content will be indexed</p>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end gap-4">
          <button 
            type="button" 
            onClick={popLayer}
            className="px-6 py-2 text-slate-500 hover:text-slate-300 font-bold uppercase text-xs transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="terminal-button rounded-lg flex items-center gap-2"
          >
            {isSubmitting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            {isSubmitting ? 'Initializing...' : 'Establish_Station'}
          </button>
        </div>
      </form>
    </div>
  )
}
