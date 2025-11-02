import { externalizePlugin, usePlugin } from "@polkahub/context";
import {
  Account,
  localStorageProvider,
  PersistenceProvider,
  Plugin,
  SerializableAccount,
} from "@polkahub/plugin";
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
  take,
  takeUntil,
  timeout,
} from "rxjs";

export const selectedAccountPluginId = "selected-account";
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
    persist: localStorageProvider(selectedAccountPluginId),
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
      filter((r) => r != null),
      switchMap((plugin) => Promise.resolve(plugin.deserialize(persisted)))
    );
  }).pipe(
    timeout({
      first: 3000,
    }),
    catchError((ex) => {
      console.error(ex);
      return [null];
    }),
    take(1)
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
    id: selectedAccountPluginId,
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

const [selectedAccount$, useSelectedAccountPlugin] =
  externalizePlugin<SelectedAccountPlugin>(selectedAccountPluginId);

const defaultedSelectedAccount$ = state(
  (id: string) =>
    selectedAccount$(id).pipe(switchMap((plugin) => plugin.selectedAccount$)),
  null
);

export const useSelectedAccount = (): [
  Account | null,
  (value: Account | null) => void
] => {
  const [id, plugin] = useSelectedAccountPlugin();
  const selectedAccount = useStateObservable(defaultedSelectedAccount$(id));

  if (!plugin) {
    console.warn("Plugin SelectedAccount not found");
    return [null, () => {}];
  }

  return [selectedAccount, plugin.setAccount];
};

export const useSetSelectedAccount = () => {
  const plugin = usePlugin<SelectedAccountPlugin>(selectedAccountPluginId);
  return plugin?.setAccount ?? null;
};
