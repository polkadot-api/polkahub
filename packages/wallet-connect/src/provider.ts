import {
  Account,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin";
import { DefaultedStateObservable, state, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import type { CaipNetwork } from "@reown/appkit/core";
import { defineChain } from "@reown/appkit/networks";
import type { SessionTypes } from "@walletconnect/types";
import { getPolkadotSignerFromPjs } from "polkadot-api/pjs-signer";
import {
  catchError,
  combineLatest,
  defer,
  EMPTY,
  filter,
  finalize,
  firstValueFrom,
  from,
  fromEventPattern,
  ignoreElements,
  map,
  Observable,
  of,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";

export const walletConnectProviderId = "walletconnect";
export interface WalletConnectAccount extends Account {
  provider: "walletconnect";
}

type WalletConnectStatus =
  | {
      type: "disconnected";
    }
  | {
      type: "connecting";
    }
  | {
      type: "connected";
      session: SessionTypes.Struct;
    };

export interface WalletConnectProvider extends Plugin<WalletConnectAccount> {
  id: "walletconnect";
  accounts$: DefaultedStateObservable<WalletConnectAccount[]>;

  toggleWalletConnect: () => void;
  walletConnectStatus$: DefaultedStateObservable<WalletConnectStatus>;
}

// https://docs.reown.com/appkit/upgrade/wcm#polkadot
// https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-13.md
export const createPolkadotChain = (
  name: string,
  genesis: string,
  nativeCurrency: CaipNetwork["nativeCurrency"],
  rpcUrl: string,
  subscanUrl?: string
) => {
  const id = genesis.startsWith("0x")
    ? genesis.slice(2, 34)
    : genesis.slice(0, 32);
  return defineChain({
    id,
    name,
    nativeCurrency,
    rpcUrls: {
      default: {
        http: [rpcUrl.replace(/^ws/, "http")],
        wss: rpcUrl.replace(/^http/, "ws"),
      },
    },
    blockExplorers: subscanUrl
      ? {
          default: {
            name: "Subscan",
            url: `https://${subscanUrl}/`,
          },
        }
      : undefined,
    chainNamespace: "polkadot",
    caipNetworkId: `polkadot:${id}`,
  });
};

export { defineChain as createGenericChain };

export const knownCurrencies = {
  DOT: { name: "Polkadot", symbol: "DOT", decimals: 10 },
  KSM: { name: "Kusama", symbol: "KSM", decimals: 12 },
  PAS: { name: "Paseo", symbol: "PAS", decimals: 12 },
};
export const knownChains = {
  polkadot: createPolkadotChain(
    "Polkadot",
    "91b171bb158e2d3848fa23a9f1c25182",
    knownCurrencies.DOT,
    "wss://rpc.polkadot.io",
    "https://polkadot.subscan.io/"
  ),
  polkadotAh: createPolkadotChain(
    "Polkadot AssetHub",
    "0x68d56f15f85d3136970ec16946040bc1",
    knownCurrencies.DOT,
    "wss://asset-hub-polkadot-rpc.dwellir.com",
    "https://assethub-polkadot.subscan.io/"
  ),
  kusama: createPolkadotChain(
    "Kusama",
    "0xb0a8d493285c2df73290dfb7e61f870f",
    knownCurrencies.KSM,
    "wss://kusama-rpc.dwellir.com",
    "https://kusama.subscan.io/"
  ),
  kusamaAh: createPolkadotChain(
    "Kusama AssetHub",
    "0x68d56f15f85d3136970ec16946040bc1",
    knownCurrencies.KSM,
    "wss://kusama-asset-hub-rpc.polkadot.io",
    "https://assethub-kusama.subscan.io/"
  ),
  paseo: createPolkadotChain(
    "paseo",
    "0x77afd6190f1554ad45fd0d31aee62aac",
    knownCurrencies.PAS,
    "wss://paseo-rpc.dwellir.com",
    "https://paseo.subscan.io/"
  ),
  paseoAh: createPolkadotChain(
    "paseo AssetHub",
    "0xd6eec26135305a8ad257a20d00335728",
    knownCurrencies.PAS,
    "wss://asset-hub-paseo-rpc.dwellir.com",
    "https://assethub-paseo.subscan.io/"
  ),
};

export const createWalletConnectProvider = (
  projectId: string,
  networks: [CaipNetwork, ...CaipNetwork[]],
  opts?: Partial<{
    persist: PersistenceProvider;
    relayUrl: string;
  }>
): WalletConnectProvider => {
  const { persist, relayUrl } = {
    persist: localStorageProvider("walletconnect-plugin"),
    relayUrl: "wss://relay.walletconnect.com",
    ...opts,
  };

  const provider$ = defer(() =>
    import("@walletconnect/universal-provider").then((mod) =>
      mod.default.init({
        projectId,
        relayUrl,
      })
    )
  ).pipe(shareReplay(1));

  const walletConnectModal$ = combineLatest([
    provider$,
    defer(() =>
      import("@reown/appkit/core").then(({ createAppKit }) => createAppKit)
    ),
  ]).pipe(
    map(([universalProvider, createAppKit]) =>
      createAppKit({
        projectId,
        universalProvider,
        networks,
        manualWCControl: true,
      })
    ),
    shareReplay(1)
  );

  interface InitializedSession {
    uri?: string;
    approval: () => Promise<SessionTypes.Struct>;
  }

  const chains = networks.map((chain) => chain.caipNetworkId);

  const initializeSession$ = () =>
    provider$.pipe(
      switchMap(
        (provider): Promise<InitializedSession> =>
          provider.client.connect({
            requiredNamespaces: {
              polkadot: {
                methods: ["polkadot_signTransaction", "polkadot_signMessage"],
                chains,
                events: ["chainChanged", "accountsChanged"],
              },
            },
          })
      )
    );

  const connect$ = combineLatest([
    defer(initializeSession$),
    walletConnectModal$,
  ]).pipe(
    switchMap(([{ uri, approval }, modal]) => {
      if (!uri) return approval();

      modal.open({ uri });
      const modal$ = fromEventPattern<{ open: boolean }>(
        (handler) => modal.subscribeState(handler),
        (_, fn) => fn()
      );
      const closed$ = modal$.pipe(filter(({ open }) => !open));

      return from(approval()).pipe(
        takeUntil(closed$),
        finalize(() => modal.close())
      );
    }),
    map((session): WalletConnectStatus => ({ type: "connected", session })),
    catchError((err) => {
      console.log("connect WalletConnect error", err);
      return of(EMPTY) as unknown as Observable<WalletConnectStatus>;
    }),
    startWith({ type: "connecting" } satisfies WalletConnectStatus)
  );
  const disconnect$ = combineLatest([
    provider$,
    import("@walletconnect/utils").then(({ getSdkError }) => getSdkError),
  ]).pipe(
    take(1),
    switchMap(([provider, getSdkError]) =>
      provider.session
        ? provider.client.disconnect({
            topic: provider.session.topic,
            reason: getSdkError("USER_DISCONNECTED"),
          })
        : EMPTY
    ),
    ignoreElements(),
    startWith({
      type: "disconnected",
    } satisfies WalletConnectStatus)
  );

  const [toggleConnect$, toggleWalletConnect] = createSignal<void>();

  const [session$, setSession] = persistedState<SessionTypes.Struct | null>(
    persist,
    null
  );

  const walletConnectStatus$ = state<WalletConnectStatus>(
    session$.pipe(
      take(1),
      switchMap((session): Observable<WalletConnectStatus> => {
        const connectState$ = toggleConnect$.pipe(
          scan((acc) => !acc, !!session),
          switchMap((connect) =>
            connect
              ? connect$.pipe(
                  tapOnLast((v) => {
                    // hack! if connect$ didn't actually complete, toggle it off
                    if (v?.type !== "connected") {
                      toggleWalletConnect();
                    }
                  })
                )
              : disconnect$
          ),
          tap((v) => {
            if (v.type === "connected") {
              setSession(v.session);
            } else {
              setSession(null);
            }
          })
        );

        return connectState$.pipe(
          startWith(
            (session
              ? {
                  type: "connected",
                  session,
                }
              : {
                  type: "disconnected",
                }) satisfies WalletConnectStatus
          )
        );
      })
    ),
    {
      type: "disconnected",
    }
  );

  const getAccounts = (session: SessionTypes.Struct) =>
    Object.values(session.namespaces)
      .map((namespace) => namespace.accounts)
      .flat()
      // Format: `polkadot:{genesis_hash}:{account_id}`
      .map((wcAccount) => wcAccount.split(":")[2]);

  const getSigner = (session: SessionTypes.Struct, address: string) =>
    getPolkadotSignerFromPjs(
      address,
      async (transactionPayload) => {
        const provider = await firstValueFrom(provider$);

        return provider.client.request({
          topic: session.topic,
          chainId: `polkadot:${transactionPayload.genesisHash.substring(
            2,
            34
          )}`,
          request: {
            method: "polkadot_signTransaction",
            params: {
              address,
              transactionPayload,
            },
          },
        });
      },
      async ({ address, data }) => {
        const provider = await firstValueFrom(provider$);

        // const chainId = provider.session.topic.split(":")[1];
        const chainId = session.topic.split(":")[1];

        return provider.client.request({
          topic: session.topic,
          chainId: `polkadot:${chainId}`,
          request: {
            method: "polkadot_signMessage",
            params: {
              address,
              message: data,
            },
          },
        });
      }
    );

  const getSignersFromSession = (
    session: SessionTypes.Struct
  ): WalletConnectAccount[] => {
    const accounts = getAccounts(session);
    return accounts.map((address) => ({
      provider: walletConnectProviderId,
      address,
      signer: getSigner(session, address),
    }));
  };

  const accounts$ = walletConnectStatus$.pipeState(
    map((status): WalletConnectAccount[] =>
      status.type === "connected" ? getSignersFromSession(status.session) : []
    ),
    withDefault([] as WalletConnectAccount[])
  );

  return {
    id: walletConnectProviderId,
    deserialize: (account) =>
      firstValueFrom(
        accounts$.pipe(
          map(
            (accounts) =>
              accounts.find((acc) => acc.address === account.address) ?? null
          )
        )
      ),
    accounts$,
    toggleWalletConnect,
    walletConnectStatus$,
  };
};

const tapOnLast =
  <T>(onLast: (value: T | null) => void) =>
  (source$: Observable<T>) =>
    defer(() => {
      let value: T | null = null;
      return source$.pipe(
        tap({
          next(v) {
            value = v;
          },
          complete() {
            onLast(value);
          },
        })
      );
    });
