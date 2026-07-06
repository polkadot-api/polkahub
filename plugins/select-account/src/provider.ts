import { externalizePlugin, usePlugin } from "@polkahub/context"
import {
  Account,
  addrEq,
  defaultSerialize,
  localStorageProvider,
  PersistenceProvider,
  Plugin,
  SerializableAccount,
  ss58Reformat,
} from "@polkahub/plugin"
import { state, StateObservable, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import {
  BehaviorSubject,
  catchError,
  combineLatestWith,
  concat,
  defer,
  distinctUntilChanged,
  endWith,
  filter,
  map,
  NEVER,
  Observable,
  of,
  Subject,
  Subscription,
  switchMap,
  takeUntil,
} from "rxjs"

export const selectedAccountPluginId = "selected-account"
export interface SelectedAccountPlugin extends Plugin {
  id: "selected-account"
  selectedAccount$: StateObservable<Account | null>
  setAccount: (value: Account | null) => void
}

export const createSelectedAccountPlugin = (
  opts?: Partial<{
    persist: PersistenceProvider
  }>,
): SelectedAccountPlugin => {
  const { persist } = {
    persist: localStorageProvider(selectedAccountPluginId),
    ...opts,
  }

  const [accountChange$, setAccount] = createSignal<Account | null>()
  const plugins$ = new BehaviorSubject<Plugin[]>([])

  const persistedValue$ = defer(() => {
    const loaded = persist.load() ?? "null"
    const persisted: SerializableAccount | null = JSON.parse(loaded)
    if (!persisted) return of(null)

    return plugins$.pipe(
      distinctUntilChanged(),
      filter((v) => v.length > 0),
      map((plugins) =>
        plugins.find((plugin) => plugin.id === persisted.provider),
      ),
      switchMap((plugin) =>
        Promise.resolve(plugin?.deserialize(persisted) ?? null),
      ),
    )
  }).pipe(
    catchError((ex) => {
      console.error(ex)
      return []
    }),
  )

  const ss58Format$ = new Subject<number>()
  const selectedAccount$ = state(
    mergeUntilNext(
      persistedValue$,
      accountChange$.pipe(
        switchMap((account) => {
          if (!account) {
            persist.save(null)
            return [null]
          }

          return plugins$.pipe(
            distinctUntilChanged(),
            map((plugins) => plugins.find((p) => p.id === account.provider)),
            switchMap((plugin) => {
              if (!plugin) return [null]

              const serializeFn = plugin.serialize ?? defaultSerialize
              persist.save(JSON.stringify(serializeFn(account)))

              return deselectWhenRemoved$(account, plugin)
            }),
          )
        }),
      ),
    ).pipe(
      combineLatestWith(ss58Format$),
      map(([account, ss58Format]) =>
        account
          ? {
              ...account,
              address: ss58Reformat(account.address, ss58Format),
            }
          : null,
      ),
    ),
  )

  return {
    id: selectedAccountPluginId,
    deserialize: () => null,
    accounts$: of([]),
    receiveContext(context) {
      plugins$.next(context.plugins)
      ss58Format$.next(context.ss58Format)
    },
    subscription$: selectedAccount$,
    selectedAccount$,
    setAccount,
  }
}

const deselectWhenRemoved$ = (value: Account, plugin: Plugin) =>
  concat([value], NEVER).pipe(
    takeUntil(
      plugin.accounts$.pipe(
        filter((accounts) => {
          const eqFn = plugin.eq ?? ((a, b) => addrEq(a.address, b.address))
          return accounts.every((acc) => !eqFn(acc, value))
        }),
      ),
    ),
    endWith(null),
  )

const [selectedAccount$, useSelectedAccountPlugin] =
  externalizePlugin<SelectedAccountPlugin>(selectedAccountPluginId)

const defaultedSelectedAccount$ = state(
  (id: string) =>
    selectedAccount$(id).pipe(switchMap((plugin) => plugin.selectedAccount$)),
  null,
)

export const useSelectedAccount = (): [
  Account | null,
  (value: Account | null) => void,
] => {
  const [id, plugin] = useSelectedAccountPlugin()
  const selectedAccount = useStateObservable(defaultedSelectedAccount$(id))

  if (!plugin) {
    console.warn("Plugin SelectedAccount not found")
    return [null, () => {}]
  }

  return [selectedAccount, plugin.setAccount]
}

export const useSetSelectedAccount = () => {
  const plugin = usePlugin<SelectedAccountPlugin>(selectedAccountPluginId)
  return plugin?.setAccount ?? null
}

const mergeUntilNext = <T>(...observables: Array<Observable<T>>) =>
  new Observable<T>((observer) => {
    const subscriptions = new Array<Subscription>()

    for (const source of observables) {
      const sub = new Subscription()
      subscriptions.push(sub)
      sub.add(
        source.subscribe({
          next: (v) => {
            const index = subscriptions.indexOf(sub)
            const deleted = subscriptions.splice(0, index)
            deleted.forEach((s) => s.unsubscribe())
            observer.next(v)
          },
          error: (e) => observer.error(e),
          complete: () => {
            const index = subscriptions.indexOf(sub)
            subscriptions.splice(index, 1)
            sub.unsubscribe()

            if (subscriptions.length === 0) observer.complete()
          },
        }),
      )
    }

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe())
    }
  })
