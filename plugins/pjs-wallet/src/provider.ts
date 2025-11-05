import {
  connectInjectedExtension,
  getInjectedExtensions,
  type InjectedExtension,
  type InjectedPolkadotAccount,
} from "@polkadot-api/pjs-signer";
import {
  Account,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin";
import {
  DefaultedStateObservable,
  state,
  StateObservable,
  withDefault,
} from "@react-rxjs/core";
import { combineKeys, MapWithChanges } from "@react-rxjs/utils";
import { getSs58AddressInfo } from "polkadot-api";
import {
  catchError,
  concat,
  defer,
  filter,
  firstValueFrom,
  fromEventPattern,
  ignoreElements,
  interval,
  map,
  NEVER,
  Observable,
  retry,
  scan,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
  timeout,
  timer,
} from "rxjs";

export const pjsWalletProviderId = "pjs-wallet";

export interface PjsWalletAccount extends Account {
  provider: "pjs-wallet";
  extensionId: string;
  injectedAccount: InjectedPolkadotAccount;
}

export interface PjsWalletProvider extends Plugin<PjsWalletAccount> {
  id: "pjs-wallet";
  accounts$: DefaultedStateObservable<PjsWalletAccount[]>;
  accountGroups$: DefaultedStateObservable<Record<string, PjsWalletAccount[]>>;

  connectedExtensions$: DefaultedStateObservable<string[]>;
  setConnectedExtensions: (value: string[]) => void;
  availableExtensions$: DefaultedStateObservable<string[]>;
  injectedExtensions$: StateObservable<
    MapWithChanges<string, InjectedExtension>
  >;
  connectedExtensionsAccounts$: StateObservable<
    {
      extension: InjectedExtension;
      accounts: PjsWalletAccount[];
    }[]
  >;
}

export const createPjsWalletProvider = (
  opts?: Partial<{
    persist: PersistenceProvider;
    accountFormat?: "ss58" | "eth" | "all";
  }>
): PjsWalletProvider => {
  const { persist, accountFormat } = {
    persist: localStorageProvider("pjs-wallet-plugin"),
    accountFormat: "all" as const,
    ...opts,
  };

  const availableExtensions$ = state(
    concat(
      timer(0, 100).pipe(
        map(getInjectedExtensions),
        filter((v) => v.length > 0),
        take(1)
      ),
      interval(2000).pipe(map(getInjectedExtensions))
    ),
    []
  );

  const [connectedExtensions$, setConnectedExtensions] = persistedState<
    string[]
  >(persist, []);

  const extension$ = state((name: string) => {
    const connect$ = availableExtensions$.pipe(
      // Wait for the extension to be available
      filter((extensions) => extensions.includes(name)),
      take(1),
      switchMap(() =>
        defer(() => connectInjectedExtension(name)).pipe(
          // PolkadotJS rejects the promise straight away instead of waiting for user input
          retry({
            delay(error) {
              if (error?.message.includes("pending authorization request")) {
                return timer(1000);
              }
              throw error;
            },
          }),
          switchMap((ext) =>
            fromEventPattern(ext.subscribe, (hd) => hd()).pipe(
              map(() => ext),
              startWith(ext)
            )
          )
        )
      ),
      catchError((e) => {
        console.error(e);
        // Deselect the extension that failed to connect
        return connectedExtensions$.pipe(
          take(1),
          tap((ext) => {
            setConnectedExtensions(ext.filter((v) => v !== name));
          }),
          ignoreElements()
        );
      })
    );

    return defer(() => {
      let disconnected = false;
      let extension: InjectedExtension | null = null;
      return concat(connect$, NEVER).pipe(
        tap({
          next(value) {
            if (value) {
              if (disconnected) {
                console.log("disconnect just after connecting");
                value.disconnect();
              } else {
                extension = value;
              }
            }
          },
          unsubscribe() {
            if (extension) {
              console.log("disconnect because of cleanup");
              extension.disconnect();
            } else {
              disconnected = true;
            }
          },
        })
      );
    });
  });

  const extensionAccounts$ = combineKeys(connectedExtensions$, (id) =>
    extension$(id).pipe(
      map((extension) => ({
        extension,
        accounts: extension.getAccounts(),
      })),
      map((extWithAccounts) => {
        if (accountFormat === "ss58") {
          extWithAccounts.accounts = extWithAccounts.accounts.filter(
            (v) => getSs58AddressInfo(v.address).isValid
          );
        }
        if (accountFormat === "eth") {
          extWithAccounts.accounts = extWithAccounts.accounts.filter((v) =>
            v.address.startsWith("0x")
          );
        }
        return extWithAccounts;
      })
    )
  ).pipe(
    // Prevent getting it ref-counted, as it disconnects from the extensions
    shareReplay(1)
  );

  const injectedExtensions$ = state(
    extensionAccounts$.pipe(mapMapWithChanges((v) => v.extension))
  );

  const connectedExtensionsAccounts$ = state(
    extensionAccounts$.pipe(
      map((extensions) =>
        Array.from(extensions.values()).map(({ extension, accounts }) => ({
          extension,
          accounts: accounts.map(
            (acc): PjsWalletAccount => ({
              provider: pjsWalletProviderId,
              address: acc.address,
              name: acc.name,
              signer: acc.polkadotSigner,
              extensionId: extension.name,
              injectedAccount: acc,
            })
          ),
        }))
      )
    )
  );

  const accountGroups$ = connectedExtensionsAccounts$.pipeState(
    map((extensionAccounts) =>
      Object.fromEntries(
        extensionAccounts.map((extAcc) => [
          extAcc.extension.name,
          extAcc.accounts,
        ])
      )
    ),
    withDefault<
      Record<string, PjsWalletAccount[]>,
      Record<string, PjsWalletAccount[]>
    >({})
  );
  const accounts$ = accountGroups$.pipeState(
    map((groups) => Object.values(groups).flat()),
    withDefault<PjsWalletAccount[], PjsWalletAccount[]>([])
  );

  return {
    id: pjsWalletProviderId,
    serialize: ({ provider, address, name, extensionId }) => ({
      provider,
      address,
      name,
      extra: extensionId,
    }),
    deserialize: (account) =>
      firstValueFrom(
        connectedExtensionsAccounts$.pipe(
          map(
            (cea) =>
              cea
                .find((ext) => ext.extension.name === account.extra)
                ?.accounts.find((acc) => acc.address === account.address) ??
              null
          ),
          filter((v) => v != null),
          timeout({
            first: 3000,
          })
        )
      ),
    eq: (a, b) => a.address === b.address && a.extensionId === b.extensionId,
    accountGroups$,
    accounts$,
    availableExtensions$,
    connectedExtensions$,
    connectedExtensionsAccounts$,
    injectedExtensions$,
    setConnectedExtensions,
  };
};

const mapMapWithChanges =
  <T, R, K>(mapFn: (value: T) => R) =>
  (
    source: Observable<MapWithChanges<K, T>>
  ): Observable<MapWithChanges<K, R>> =>
    source.pipe(
      scan(
        (acc: MapWithChanges<K, R>, v) => {
          v.changes.forEach((key) => {
            if (!v.has(key)) {
              acc.delete(key);
            } else {
              acc.set(key, mapFn(v.get(key)!));
            }
          });
          acc.changes = v.changes;
          return acc;
        },
        Object.assign(new Map<K, R>(), {
          changes: new Set<K>(),
        })
      )
    );
