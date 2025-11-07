import {
  ss58Reformat,
  type Account,
  type AccountAddress,
  type Plugin,
} from "@polkahub/plugin";
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
  getIdentity: (
    address: AccountAddress
  ) => Promise<Identity | null> | Observable<Identity | null>;
  getBalance: (
    address: AccountAddress
  ) => Promise<Balance | null> | Observable<Balance | null>;
  ss58Format?: number | Promise<number> | Observable<number>;
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
    ((address: AccountAddress) => Observable<Identity | null>) | null
  >;
  balanceProvider$: DefaultedStateObservable<
    ((address: AccountAddress) => Observable<Balance | null>) | null
  >;
  ss58Format$: DefaultedStateObservable<number>;

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

  const pluginAccountGroups = state((plugin: Plugin) =>
    combineLatest([
      plugin.accountGroups$ ??
        plugin.accounts$.pipe(map((accounts) => ({ [plugin.id]: accounts }))),
      ss58Format$,
    ]).pipe(
      map(([groups, ss58Format]) =>
        Object.fromEntries(
          Object.entries(groups).map(([name, group]) => [
            name,
            group
              .map((account): Account | null => {
                try {
                  return {
                    ...account,
                    address: ss58Reformat(account.address, ss58Format),
                  };
                } catch (ex) {
                  return account;
                }
              })
              .filter((v) => v != null),
          ])
        )
      ),
      catchError((ex) => {
        console.error(`Plugin ${plugin.id} accounts observable crashed`, ex);
        return of({});
      })
    )
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

  const asyncFnToObservableFn =
    <T, A extends any[]>(fn: (...args: A) => Promise<T> | Observable<T>) =>
    (...args: A) =>
      from(fn(...args));

  const identityProvider$ = state(
    optionsChange$.pipe(
      map((v) => v.getIdentity),
      filter((v) => v != null),
      distinctUntilChanged(),
      map(asyncFnToObservableFn)
    ),
    asyncFnToObservableFn(opts?.getIdentity ?? (async () => null))
  );
  const balanceProvider$ = state(
    optionsChange$.pipe(
      map((v) => v.getBalance),
      filter((v) => v != null),
      distinctUntilChanged(),
      map(asyncFnToObservableFn)
    ),
    asyncFnToObservableFn(opts?.getBalance ?? (async () => null))
  );

  const initialAddrFormat = opts?.ss58Format ?? 42;
  const initialAddrFormat$ =
    typeof initialAddrFormat === "number"
      ? of(initialAddrFormat)
      : initialAddrFormat;
  const ss58Format$ = state(
    merge(
      initialAddrFormat$,
      optionsChange$.pipe(
        map((v) => v.ss58Format),
        filter((v) => v != null),
        distinctUntilChanged(),
        switchMap((v) => (typeof v === "number" ? of(v) : v))
      )
    ).pipe(distinctUntilChanged()),
    42
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
    combineLatest([plugins$, ss58Format$]).pipe(
      tap(([plugins, ss58Format]) => {
        const context = {
          plugins,
          ss58Format,
        };
        plugins.forEach((p) => p.receiveContext?.(context));
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
    ss58Format$,
    destroy,
    identityProvider$,
    plugin$,
    pluginAccounts$,
    plugins$,
    setOptions,
    setPlugins,
  };
}
