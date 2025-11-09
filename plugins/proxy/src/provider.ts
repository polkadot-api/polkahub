import { getProxySigner } from "@polkadot-api/meta-signers";
import {
  Account,
  AccountAddress,
  addrEq,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
  SerializableAccount,
} from "@polkahub/plugin";
import { DefaultedStateObservable, state } from "@react-rxjs/core";
import { PolkadotSigner } from "polkadot-api";
import { BehaviorSubject, combineLatest, map, switchMap } from "rxjs";

export interface ProxyInfo {
  real: AccountAddress;
  parentSigner: SerializableAccount;
  name?: string;
}

export const proxyProviderId = "proxy";
export interface ProxyAccount extends Account {
  provider: "proxy";
  info: ProxyInfo;
}

export interface ProxyProvider extends Plugin<ProxyAccount> {
  id: "proxy";
  accounts$: DefaultedStateObservable<ProxyAccount[]>;

  setProxies: (proxies: ProxyInfo[]) => void;
  addProxy: (proxy: ProxyInfo) => Promise<ProxyAccount | null>;
  removeProxy: (proxy: ProxyInfo) => void;
}

export const createProxyProvider = (
  opts?: Partial<{
    persist: PersistenceProvider;
  }>
): ProxyProvider => {
  const { persist } = {
    persist: localStorageProvider("proxies"),
    ...opts,
  };

  const [persistedAccounts$, setPersistedAccounts] = persistedState(
    persist,
    [] as ProxyInfo[]
  );
  const plugins$ = new BehaviorSubject<Plugin[]>([]);

  const getAccount = (
    info: ProxyInfo,
    parentSigner: PolkadotSigner
  ): ProxyAccount => ({
    provider: proxyProviderId,
    address: info.real,
    signer: getProxySigner(info, parentSigner),
    name: info.name,
    info,
  });

  const proxyInfoToAccount = async (info: ProxyInfo) => {
    const plugins = plugins$.getValue();
    const plugin = plugins.find((p) => info.parentSigner?.provider === p.id);
    if (!plugin) return null;
    const parentSigner = await plugin.deserialize(info.parentSigner);
    if (!parentSigner?.signer) return null;
    return getAccount(info, parentSigner.signer);
  };

  const accounts$ = state(
    combineLatest([persistedAccounts$, plugins$]).pipe(
      switchMap(([accounts]) => Promise.all(accounts.map(proxyInfoToAccount))),
      map((v) => v.filter((v) => v !== null))
    ),
    []
  );

  return {
    id: proxyProviderId,
    deserialize: (account) => {
      const extra = account.extra as ProxyInfo;
      return proxyInfoToAccount(extra);
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
              addrEq(v.parentSigner.address, proxy.parentSigner.address)
          )
        )
          return prev;
        return [...prev, proxy];
      });
      return proxyInfoToAccount(proxy);
    },
    removeProxy: (proxy) =>
      setPersistedAccounts((prev) =>
        prev.filter(
          (v) =>
            !(
              addrEq(v.real, proxy.real) &&
              addrEq(v.parentSigner.address, proxy.parentSigner.address)
            )
        )
      ),
  };
};
