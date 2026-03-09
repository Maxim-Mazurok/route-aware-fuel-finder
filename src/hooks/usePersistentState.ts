import { useEffect, useState } from 'react'

function getStorage() {
  if (typeof window === 'undefined') {
    return null
  }

  const candidate = window.localStorage

  if (
    !candidate ||
    typeof candidate.getItem !== 'function' ||
    typeof candidate.setItem !== 'function'
  ) {
    return null
  }

  return candidate
}

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const storage = getStorage()
    const existing = storage?.getItem(key)

    if (!existing) {
      return initialValue
    }

    try {
      return JSON.parse(existing) as T
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    const storage = getStorage()
    storage?.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue] as const
}
