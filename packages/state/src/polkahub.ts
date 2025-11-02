import type { Account, AccountAddress, Plugin } from "@polkahub/plugin";
import { combineKeys, createSignal } from "@react-rxjs/utils";
import { DefaultedStateObservable, state } from "@rx-state/core";
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  EMPTY,
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from "rxjs";

export interface Identity {
  name: string;
  verified: boolean;
  subId?: string;
}

export interface Balance {
  value: bigint;
  decimals: number;
  symbol?: string;
}

interface PolkaHubOptions {
  getIdentity: (address: AccountAddress) => Promise<Identity | null>;
  getBalance: (address: AccountAddress) => Promise<Balance | null>;
}

type PluginInput =
  | Array<Plugin<any> | Promise<Plugin<any>>>
  | Promise<Array<Plugin<any>>>
  | Observable<Plugin<any>[]>;

export interface PolkaHub {
  plugins$: DefaultedStateObservable<Plugin[]>;
  plugin$: <T extends Plugin<any>>(
    id: string
  ) => DefaultedStateObservable<T | null>;
  availableAccounts$: DefaultedStateObservable<Record<string, Account[]>>;
  pluginAccounts$: <A extends Account>(
    id: string
  ) => DefaultedStateObservable<A[]>;

  identityProvider$: DefaultedStateObservable<
    ((address: AccountAddress) => Promise<Identity | null>) | null
  >;
  balanceProvider$: DefaultedStateObservable<
    ((address: AccountAddress) => Promise<Balance | null>) | null
  >;

  setPlugins: (plugins: PluginInput) => void;
  setOptions: (opts: Partial<PolkaHubOptions>) => void;

  destroy: () => void;
}

const parsePluginInput = (pluginInput: PluginInput): Observable<Plugin[]> => {
  if (Array.isArray(pluginInput)) {
    return combineLatest(pluginInput.map((p) => Promise.resolve(p)));
  }
  return from(pluginInput);
};

export function createPolkaHub(
  plugins: PluginInput,
  opts?: Partial<PolkaHubOptions>
): PolkaHub {
  const [pluginsChange$, setPlugins] = createSignal<PluginInput>();
  const plugins$ = state(
    pluginsChange$.pipe(startWith(plugins), switchMap(parsePluginInput)),
    []
  );
  const plugin$ = state(
    <T extends Plugin<any>>(id: string) =>
      plugins$.pipe(
        map(
          (plugins) => (plugins.find((p) => p.id === id) ?? null) as T | null
        ),
        distinctUntilChanged<T | null>()
      ),
    null
  ) as <T extends Plugin<any>>(
    id: string
  ) => DefaultedStateObservable<T | null>;

  const pluginAccountGroups = (plugin: Plugin) =>
    (
      plugin.accountGroups$ ??
      plugin.accounts$.pipe(map((accounts) => ({ [plugin.id]: accounts })))
    ).pipe(
      catchError((ex) => {
        console.error(`Plugin ${plugin.id} accounts observable crashed`, ex);
        return of({});
      })
    );
  const availableAccounts$ = state(
    combineKeys(plugins$, pluginAccountGroups).pipe(
      map((pluginMap) => Array.from(pluginMap.values())),
      map((groups) =>
        groups.reduce(
          (acc: Record<string, Account[]>, v) => ({
            ...acc,
            ...v,
          }),
          {}
        )
      )
    ),
    {}
  );
  const pluginAccounts$ = state(
    (id: string) =>
      plugin$(id).pipe(
        switchMap((plugin) =>
          plugin
            ? pluginAccountGroups(plugin).pipe(
                map((groups) => Object.values(groups).flat())
              )
            : [[]]
        )
      ),
    []
  ) as <A extends Account>(id: string) => DefaultedStateObservable<A[]>;

  const [optionsChange$, setOptions] = createSignal<Partial<PolkaHubOptions>>();
  const identityProvider$ = state(
    optionsChange$.pipe(
      map((v) => v.getIdentity),
      filter((v) => v != null),
      distinctUntilChanged()
    ),
    opts?.getIdentity ?? (async () => null)
  );
  const balanceProvider$ = state(
    optionsChange$.pipe(
      map((v) => v.getBalance),
      filter((v) => v != null),
      distinctUntilChanged()
    ),
    opts?.getBalance ?? (async () => null)
  );

  const sub = merge(
    combineKeys(
      plugins$,
      (plugin) =>
        plugin.subscription$?.pipe(
          catchError((ex) => {
            console.error(`Plugin ${plugin.id} subscription crashed`, ex);
            return EMPTY;
          })
        ) ?? EMPTY
    ),
    plugins$.pipe(
      tap((plugins) => {
        plugins.forEach((p) => p.receivePlugins?.(plugins));
      })
    ),
    availableAccounts$,
    identityProvider$,
    balanceProvider$,
    combineKeys(plugins$.pipe(map((v) => v.map((p) => p.id))), (id) =>
      merge(plugin$(id), pluginAccounts$(id))
    )
  ).subscribe();
  const destroy = () => sub.unsubscribe();

  return {
    availableAccounts$,
    balanceProvider$,
    destroy,
    identityProvider$,
    plugin$,
    pluginAccounts$,
    plugins$,
    setOptions,
    setPlugins,
  };
}
