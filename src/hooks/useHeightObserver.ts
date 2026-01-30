import { useEffect, useRef } from 'react'

export const useHeightObserver = (onHeightChange?: (height: number) => void) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !onHeightChange) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height)
      }
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [onHeightChange])

  return ref
}
