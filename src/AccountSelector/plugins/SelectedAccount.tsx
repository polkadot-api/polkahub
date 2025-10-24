import { state, StateObservable, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import {
  BehaviorSubject,
  catchError,
  concat,
  defer,
  endWith,
  filter,
  map,
  NEVER,
  of,
  switchMap,
  takeUntil,
  timeout,
} from "rxjs";
import { useAccountSelectorContext } from "../context";
import { localStorageProvider, PersistenceProvider } from "./persist";
import { Account, Plugin, SerializableAccount } from "./plugin";

export interface SelectedAccountPlugin extends Plugin {
  id: "selected-account";
  selectedAccount$: StateObservable<Account | null>;
  setAccount: (value: Account | null) => void;
}

export const createSelectedAccountPlugin = (
  opts?: Partial<{
    persist: PersistenceProvider;
  }>
): SelectedAccountPlugin => {
  const { persist } = {
    persist: localStorageProvider("selected-account"),
    ...opts,
  };

  const [accountChange$, setAccount] = createSignal<Account | null>();
  const plugins$ = new BehaviorSubject<Plugin[]>([]);

  const initialValue$ = defer(() => {
    const loaded = persist.load() ?? "null";
    const persisted: SerializableAccount | null = JSON.parse(loaded);
    if (!persisted) return of(null);

    return plugins$.pipe(
      map((plugins) =>
        plugins.find((plugin) => plugin.id === persisted.provider)
      ),
      switchMap((plugin) =>
        plugin ? Promise.resolve(plugin.deserialize(persisted)) : [null]
      )
    );
  }).pipe(
    timeout({
      first: 3000,
    }),
    catchError((ex) => {
      console.error(ex);
      return [null];
    })
  );

  const selectedAccount$ = state(
    concat(
      initialValue$,
      accountChange$.pipe(
        switchMap((account) => {
          if (!account) {
            persist.save(null);
            return [null];
          }

          return plugins$.pipe(
            map((plugins) => plugins.find((p) => p.id === account.provider)),
            switchMap((plugin) => {
              if (!plugin) return [null];

              const serializeFn =
                plugin.serialize ??
                (({ provider, address, name }) => ({
                  provider,
                  address,
                  name,
                }));
              persist.save(JSON.stringify(serializeFn(account)));

              return deselectWhenRemoved$(account, plugin);
            })
          );
        })
      )
    )
  );

  return {
    id: "selected-account",
    deserialize: () => null,
    accounts$: of([]),
    receivePlugins(plugins) {
      plugins$.next(plugins);
    },
    subscription$: selectedAccount$,
    selectedAccount$,
    setAccount,
  };
};

const deselectWhenRemoved$ = (value: Account, plugin: Plugin) =>
  concat([value], NEVER).pipe(
    takeUntil(
      plugin.accounts$.pipe(
        filter((accounts) => {
          const eqFn = plugin.eq ?? ((a, b) => a.address === b.address);
          return accounts.every((acc) => !eqFn(acc, value));
        })
      )
    ),
    endWith(null)
  );

export const useSelectedAccount = () => {
  const ctx = useAccountSelectorContext();
  const plugin = ctx.plugins.find(
    (plugin) => plugin.id === "selected-account"
  ) as SelectedAccountPlugin | undefined;
  if (!plugin) throw new Error("Plugin SelectedAccount not found");
  const selectedAccount = useStateObservable(plugin.selectedAccount$);

  return [selectedAccount, plugin.setAccount] as const;
};
