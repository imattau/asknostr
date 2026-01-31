import React from 'react'
import { MentionsInput, Mention } from 'react-mentions'
import { Loader2, Paperclip, Share2 } from 'lucide-react'

type ComposerVariant = 'feed' | 'community'

export type ComposerSeedingStatus = {
  name: string
  status: 'in-progress' | 'ready' | 'failed'
  magnet?: string
}

interface ComposerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  onUserSearch: (query: string, callback: (data: { id: string; display: string }[]) => void) => void
  isNsfw: boolean
  onNsfwChange: (checked: boolean) => void
  onAttachMedia: () => void
  onAttachTorrent: () => void
  onPublish: () => void
  publishLabel: string
  publishingLabel?: string
  isPublishing: boolean
  isUploadingMedia: boolean
  isSeeding: boolean
  seedingStatus: ComposerSeedingStatus | null
  variant: ComposerVariant
  theme?: 'light' | 'dark' | string
  borderClassName?: string
  mutedTextClassName?: string
  secondaryTextClassName?: string
}

const mentionStyleBase = {
  control: {
    backgroundColor: 'transparent',
    fontFamily: 'inherit',
  },
  '&multiLine': {
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
      borderRadius: 12,
      overflow: 'hidden',
    },
    item: {
      borderBottom: '1px solid var(--border-slate)',
      color: 'var(--muted)',
      '&focused': {
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: 'var(--accent-cyan)',
      },
    },
  },
}

const mentionStyleByVariant = {
  feed: {
    ...mentionStyleBase,
    control: {
      ...mentionStyleBase.control,
      fontSize: 14,
      lineHeight: '1.5rem',
    },
    '&multiLine': {
      ...mentionStyleBase['&multiLine'],
      control: {
        minHeight: 64,
      },
    },
    suggestions: {
      ...mentionStyleBase.suggestions,
      list: {
        ...mentionStyleBase.suggestions.list,
        fontSize: 12,
      },
      item: {
        ...mentionStyleBase.suggestions.item,
        padding: '8px 12px',
      },
    },
  },
  community: {
    ...mentionStyleBase,
    control: {
      ...mentionStyleBase.control,
      fontSize: 12,
      lineHeight: '1.25rem',
    },
    '&multiLine': {
      ...mentionStyleBase['&multiLine'],
      control: {
        minHeight: 40,
      },
    },
    suggestions: {
      ...mentionStyleBase.suggestions,
      list: {
        ...mentionStyleBase.suggestions.list,
        fontSize: 11,
      },
      item: {
        ...mentionStyleBase.suggestions.item,
        padding: '6px 10px',
      },
    },
  },
} as const

const textareaClasses: Record<ComposerVariant, string> = {
  feed: 'relative w-full min-h-[4rem] mt-3 font-sans text-sm leading-6',
  community: 'relative w-full min-h-[2.5rem] mt-1 font-sans text-xs leading-5',
}

export const Composer: React.FC<ComposerProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  onUserSearch,
  isNsfw,
  onNsfwChange,
  onAttachMedia,
  onAttachTorrent,
  onPublish,
  publishLabel,
  publishingLabel,
  isPublishing,
  isUploadingMedia,
  isSeeding,
  seedingStatus,
  variant,
  theme = 'dark',
  borderClassName = 'border-white/5',
  mutedTextClassName = 'text-slate-500',
  secondaryTextClassName = 'text-slate-400',
}) => {
  const mentionStyle = mentionStyleByVariant[variant]
  const labelTextClass = variant === 'feed' ? 'text-[9px] uppercase font-mono' : 'text-[8px] font-mono uppercase'
  const footerBorderClass = variant === 'feed' ? 'border-white/5' : borderClassName
  const footerTextClass = variant === 'feed' ? 'text-[9px]' : 'text-[9px]'
  const buttonBaseClass = variant === 'feed'
    ? 'p-1.5 rounded-lg hover:bg-white/5'
    : `p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`

  const publishText = isPublishing ? (publishingLabel ?? publishLabel) : publishLabel

  return (
    <>
      <div className={textareaClasses[variant]}>
        <MentionsInput
          value={value}
          onChange={(_event, newValue) => onChange(newValue)}
          placeholder={placeholder}
          disabled={disabled}
          style={mentionStyle}
          classNames={{ input: 'focus:ring-0 w-full' }}
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
      <div className={`flex items-center justify-between ${variant === 'feed' ? 'pt-2 border-t mt-3' : 'mt-2 pt-2 border-t'} ${footerBorderClass} ${footerTextClass}`}>
        <label className={`flex items-center gap-2 ${labelTextClass} ${mutedTextClassName}`}>
          <input type="checkbox" checked={isNsfw} onChange={(e) => onNsfwChange(e.target.checked)} className="accent-red-500" /> NSFW
        </label>
        {variant === 'feed' ? (
          <div className="flex flex-col gap-1 items-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isUploadingMedia || isSeeding || disabled}
                onClick={onAttachMedia}
                className={`${buttonBaseClass} ${secondaryTextClassName} transition-colors disabled:opacity-50`}
                title="Attach Media"
              >
                {isUploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              </button>
              <button
                type="button"
                disabled={isUploadingMedia || isSeeding || disabled}
                onClick={onAttachTorrent}
                className={`${buttonBaseClass} text-purple-400 transition-colors disabled:opacity-50`}
                title="Seed via BitTorrent"
              >
                {isSeeding ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              </button>
            </div>
            <button
              onClick={onPublish}
              disabled={disabled || !value.trim() || isPublishing || isSeeding}
              className="terminal-button rounded-lg text-[10px] py-1 px-3"
            >
              {publishText}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploadingMedia || isSeeding || disabled}
              onClick={onAttachMedia}
              className={`${buttonBaseClass} ${secondaryTextClassName} transition-colors disabled:opacity-50`}
              title="Attach Media"
            >
              {isUploadingMedia ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            </button>
            <button
              type="button"
              disabled={isUploadingMedia || isSeeding || disabled}
              onClick={onAttachTorrent}
              className={`${buttonBaseClass} text-purple-400 transition-colors disabled:opacity-50`}
              title="Seed via BitTorrent"
            >
              {isSeeding ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
            </button>
            <button
              onClick={onPublish}
              disabled={disabled || !value.trim() || isPublishing || isSeeding}
              className="terminal-button rounded py-1 px-3 text-[9px]"
            >
              {publishText}
            </button>
          </div>
        )}
        {seedingStatus && (
          <p className={`text-[9px] font-mono uppercase tracking-[0.3em] text-cyan-300 ${variant === 'community' ? 'text-right' : ''}`}>
            {seedingStatus.status === 'in-progress' && !seedingStatus.magnet && <>Seeding {seedingStatus.name}…</>}
            {seedingStatus.status === 'in-progress' && seedingStatus.magnet && <>Uploading Web Mirror…</>}
            {seedingStatus.status === 'ready' && <>Magnet & Mirror Ready</>}
            {seedingStatus.status === 'failed' && <>Failed to seed {seedingStatus.name}</>}
          </p>
        )}
      </div>
    </>
  )
}
