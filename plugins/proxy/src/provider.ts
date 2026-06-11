import { getProxyTxCreator, WrapTxCreator } from "@polkadot-api/meta-signers"
import {
  Account,
  AccountAddress,
  addrEq,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
  SerializableAccount,
  TxCreator,
} from "@polkahub/plugin"
import { DefaultedStateObservable, state } from "@react-rxjs/core"
import {
  BehaviorSubject,
  combineLatest,
  filter,
  firstValueFrom,
  map,
  switchMap,
  timeout,
} from "rxjs"

export interface ProxyInfo {
  real: AccountAddress
  parentSigner: SerializableAccount
  name?: string
}

export const proxyProviderId = "proxy"
export interface ProxyAccount<
  T extends TxCreator<any> = TxCreator<any>,
> extends Account<WrapTxCreator<T>> {
  provider: "proxy"
  info: ProxyInfo
}

export type ProxyEntry = {
  delegate: AccountAddress
  proxy_type: {
    type: string
  }
  delay: number
}

export type GetDelegates = (
  address: AccountAddress,
) => Promise<Array<ProxyEntry> | null>

export interface ProxyProvider extends Plugin<ProxyAccount> {
  id: "proxy"
  accounts$: DefaultedStateObservable<ProxyAccount[]>

  setProxies: (proxies: ProxyInfo[]) => void
  addProxy: (proxy: ProxyInfo) => Promise<ProxyAccount | null>
  removeProxy: (proxy: ProxyInfo) => void

  getDelegates: GetDelegates
}

export const createProxyProvider = (
  getDelegates: GetDelegates,
  opts?: Partial<{
    persist: PersistenceProvider
  }>,
): ProxyProvider => {
  const { persist } = {
    persist: localStorageProvider("proxies"),
    ...opts,
  }

  const [persistedAccounts$, setPersistedAccounts] = persistedState(
    persist,
    [] as ProxyInfo[],
  )
  const plugins$ = new BehaviorSubject<Plugin[]>([])

  const getAccount = <T extends TxCreator<any>>(
    info: ProxyInfo,
    parentSigner?: T & { publicKey?: Uint8Array },
  ): ProxyAccount<T> => {
    if (parentSigner && !parentSigner.publicKey)
      throw new Error("Proxy provider requires TxCreator with `publicKey`.")
    return {
      provider: proxyProviderId,
      address: info.real,
      txCreator: parentSigner
        ? getProxyTxCreator(info, parentSigner as any)
        : undefined,
      name: info.name,
      info,
    }
  }

  const proxyInfoToAccount = async (info: ProxyInfo) => {
    try {
      const plugin = await firstValueFrom(
        plugins$.pipe(
          map((plugins) =>
            plugins.find((p) => info.parentSigner?.provider === p.id),
          ),
          filter((v) => v != null),
          timeout({
            first: 3000,
          }),
        ),
      )

      if (!plugin) return getAccount(info)
      const parentSigner = await plugin.deserialize(info.parentSigner)
      return getAccount(info, parentSigner?.txCreator)
    } catch (ex) {
      console.error(ex)
      return getAccount(info)
    }
  }

  const accounts$ = state(
    combineLatest([persistedAccounts$, plugins$]).pipe(
      switchMap(([accounts]) => Promise.all(accounts.map(proxyInfoToAccount))),
    ),
    [],
  )

  return {
    id: proxyProviderId,
    deserialize: (account) => {
      const extra = account.extra as ProxyInfo
      return proxyInfoToAccount(extra)
    },
    serialize: ({ address, info, provider }) => ({
      address,
      provider,
      extra: info,
    }),
    eq: (a, b) =>
      addrEq(a.address, b.address) &&
      addrEq(a.info.parentSigner?.address, b.info.parentSigner?.address),
    accounts$,
    receiveContext: (ctx) => plugins$.next(ctx.plugins),
    subscription$: accounts$,
    setProxies: setPersistedAccounts,
    addProxy: (proxy) => {
      setPersistedAccounts((prev) => {
        if (
          prev.some(
            (v) =>
              addrEq(v.real, proxy.real) &&
              addrEq(v.parentSigner.address, proxy.parentSigner.address),
          )
        )
          return prev
        return [...prev, proxy]
      })
      return proxyInfoToAccount(proxy)
    },
    removeProxy: (proxy) =>
      setPersistedAccounts((prev) =>
        prev.filter(
          (v) =>
            !(
              addrEq(v.real, proxy.real) &&
              addrEq(v.parentSigner.address, proxy.parentSigner.address)
            ),
        ),
      ),
    getDelegates,
  }
}
