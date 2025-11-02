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
  retry,
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
  }>
): PjsWalletProvider => {
  const { persist } = {
    persist: localStorageProvider("pjs-wallet-plugin"),
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

  const injectedExtensions$ = state(
    combineKeys(connectedExtensions$, extension$).pipe(
      // Prevent getting it ref-counted, as it disconnects from the extensions
      shareReplay(1)
    )
  );

  const connectedExtensionsAccounts$ = injectedExtensions$.pipeState(
    map((extensions) =>
      Array.from(extensions.values()).map((extension) => ({
        extension,
        accounts: extension.getAccounts().map(
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
