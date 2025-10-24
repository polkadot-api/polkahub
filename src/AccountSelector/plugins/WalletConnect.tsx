import { DefaultedStateObservable, state, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { createAppKit } from "@reown/appkit/core";
import { defineChain } from "@reown/appkit/networks";
import { SessionTypes } from "@walletconnect/types";
import UniversalProvider from "@walletconnect/universal-provider";
import { getSdkError } from "@walletconnect/utils";
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
  startWith,
  switchMap,
  take,
  takeUntil,
  tap,
} from "rxjs";
import {
  localStorageProvider,
  persistedState,
  PersistenceProvider,
} from "./persist";
import { Plugin, Account } from "./plugin";

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

export const createWalletConnectProvider = (
  projectId: string,
  opts?: Partial<{
    persist: PersistenceProvider;
  }>
): WalletConnectProvider => {
  const { persist } = {
    persist: localStorageProvider("walletconnect-plugin"),
    ...opts,
  };

  // https://docs.reown.com/advanced/multichain/polkadot/dapp-integration-guide
  const universalProvider = UniversalProvider.init({
    projectId,
    relayUrl: "wss://relay.walletconnect.com",
  });

  // https://docs.reown.com/appkit/upgrade/wcm#polkadot
  const polkadot = defineChain({
    // https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-13.md
    id: "91b171bb158e2d3848fa23a9f1c25182",
    name: "Polkadot",
    nativeCurrency: { name: "Polkadot", symbol: "DOT", decimals: 10 },
    rpcUrls: {
      default: {
        http: ["https://rpc.polkadot.io"],
        wss: "wss://rpc.polkadot.io",
      },
    },
    blockExplorers: {
      default: {
        name: "Polkadot Explorer",
        url: "https://polkadot.js.org/apps/",
      },
    },
    chainNamespace: "polkadot",
    caipNetworkId: "polkadot:91b171bb158e2d3848fa23a9f1c25182",
  });

  const walletConnectModal = universalProvider.then((universalProvider) =>
    createAppKit({
      projectId,
      universalProvider,
      networks: [polkadot],
      manualWCControl: true,
    })
  );

  interface InitializedSession {
    uri?: string;
    approval: () => Promise<SessionTypes.Struct>;
  }

  const provider$ = from(universalProvider);
  const initializeSession$ = () =>
    provider$.pipe(
      switchMap(
        (provider): Promise<InitializedSession> =>
          provider.client.connect({
            requiredNamespaces: {
              polkadot: {
                methods: ["polkadot_signTransaction", "polkadot_signMessage"],
                chains: [polkadot].map((chain) => chain.caipNetworkId),
                events: ["chainChanged", "accountsChanged"],
              },
            },
          })
      )
    );

  const connect$ = combineLatest([
    defer(initializeSession$),
    walletConnectModal,
  ]).pipe(
    switchMap(([{ uri, approval }, modal]) => {
      if (!uri) return approval();

      modal.open({ uri });
      const modal$ = fromEventPattern<{ open: boolean }>(
        (handler) => modal.subscribeState(handler),
        (_, fn) => fn()
      );
      const closed$ = modal$.pipe(
        tap((v) => console.log("modal event", v)),
        filter(({ open }) => !open)
      );

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
  const disconnect$ = provider$.pipe(
    take(1),
    switchMap((provider) =>
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
      provider: "walletconnect",
      address,
      signer: getSigner(session, address),
      // TODO name?
    }));
  };

  const accounts$ = walletConnectStatus$.pipeState(
    map((status): WalletConnectAccount[] =>
      status.type === "connected" ? getSignersFromSession(status.session) : []
    ),
    withDefault([] as WalletConnectAccount[])
  );

  return {
    id: "walletconnect",
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
  <T,>(onLast: (value: T | null) => void) =>
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
