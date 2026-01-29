/// <reference types="vite/client" />

declare module 'react-mentions' {
  import * as React from 'react'

  export interface MentionProps {
    onAdd?: (id: string | number, display: string) => void
    onRemove?: (id: string | number, display: string) => void
    renderSuggestion?: (
      suggestion: any,
      search: string,
      highlightedDisplay: React.ReactNode,
      index: number,
      focused: boolean
    ) => React.ReactNode
    trigger: string | RegExp
    data: any[] | ((query: string, callback: (data: any[]) => void) => void)
    className?: string
    style?: any
    appendSpaceOnAdd?: boolean
    displayTransform?: (id: string, display: string) => string
    markup?: string
  }

  export const Mention: React.FC<MentionProps>

  export interface MentionsInputProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onSelect' | 'style'> {
    value: string
    onChange: (event: { target: { value: string } }, newValue: string, newPlainTextValue: string, mentions: any[]) => void
    placeholder?: string
    onSelect?: (event: React.UIEvent) => void
    onBlur?: (event: React.FocusEvent, clickedSuggestion: boolean) => void
    onKeyDown?: (event: React.KeyboardEvent) => void
    children: React.ReactElement<MentionProps> | Array<React.ReactElement<MentionProps>>
    className?: string
    style?: any
    classNames?: any
    singleLine?: boolean
    allowSpaceInQuery?: boolean
    suggestionPortalHost?: Element
    inputRef?: React.Ref<HTMLTextAreaElement | HTMLInputElement>
  }

  export const MentionsInput: React.FC<MentionsInputProps>
}