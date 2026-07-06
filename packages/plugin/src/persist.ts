import { state } from "@rx-state/core"
import { createSignal } from "@react-rxjs/utils"
import { map, scan, tap } from "rxjs"

export interface PersistenceProvider {
  save: (value: string | null) => void
  load: () => string | null
}

export const localStorageProvider = (key: string): PersistenceProvider => ({
  save: (value: string | null) => {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  },
  load: () => localStorage.getItem(key),
})

export interface Serializer<T = unknown> {
  stringify: (value: T) => string
  parse: (value: string) => T
}
export const persistedState = <T>(
  provider: PersistenceProvider,
  defaultValue: T,
  serializer: Serializer<T> = JSON,
) => {
  const [valueChange$, setValue] = createSignal<T | ((prev: T) => T)>()

  const initialValue = (() => {
    const initialValueStr = provider.load()
    try {
      return initialValueStr != null
        ? ((JSON.parse(initialValueStr) as T) ?? defaultValue)
        : defaultValue
    } catch (ex) {
      console.error(ex)
      return defaultValue
    }
  })()

  const state$ = state(
    valueChange$.pipe(
      scan((acc, v) => {
        if (typeof v === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          v = (v as any)(acc)
        }
        return v as T
      }, initialValue),
      tap((v) => provider.save(v == null ? null : serializer.stringify(v))),
      map((v) => (v === null ? defaultValue : v)),
    ),
    initialValue,
  )
  state$.subscribe()

  return [state$, setValue] as const
}
