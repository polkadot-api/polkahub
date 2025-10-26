import {
  DefaultedStateObservable,
  state,
  StateObservable,
} from "@react-rxjs/core";
import {
  combineKeys,
  createKeyedSignal,
  createSignal,
  mergeWithKey,
} from "@react-rxjs/utils";
import { map, scan } from "rxjs";
import type { Account, Plugin } from "@polkahub/plugin";

const [addInstance$, addInstance] = createSignal<string>();
const [removeInstance$, removeInstance] = createSignal<string>();
export { addInstance, removeInstance };
export const contextInstances$: DefaultedStateObservable<string[]> = state(
  mergeWithKey({ addInstance$, removeInstance$ }).pipe(
    scan((acc: Record<string, number>, v) => {
      acc[v.payload] =
        (acc[v.payload] ?? 0) + (v.type === "addInstance$" ? 1 : -1);
      return acc;
    }, {}),
    map((v) => Object.keys(v))
  ),
  []
);
contextInstances$.subscribe();

const [pluginsChange$, changePlugins] = createKeyedSignal<string, Plugin[]>();
export const setPlugins = (id: string, plugins: Plugin[]) => {
  plugins.forEach((p) => p.receivePlugins?.(plugins));
  changePlugins(id, plugins);
};

export const plugins$: (id: string) => StateObservable<Plugin<Account>[]> =
  state((id: string) => pluginsChange$(id));

export const availableAccounts$: (
  id: string
) => StateObservable<Record<string, Account[]>> = state((id: string) =>
  combineKeys(plugins$(id), (plugin) => plugin.accounts$).pipe(
    map((pluginMap) =>
      Object.fromEntries(
        Array.from(pluginMap.entries()).map(([plugin, accounts]) => [
          plugin.id,
          accounts,
        ])
      )
    )
  )
);

export const subscription$: (
  id: string
) => StateObservable<Record<string, Account[]>> = state((id: string) =>
  availableAccounts$(id)
);
