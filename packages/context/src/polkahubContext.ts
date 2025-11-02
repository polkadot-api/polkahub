import type { AccountAddress, Plugin } from "@polkahub/plugin";
import type { Balance, Identity, PolkaHub } from "@polkahub/state";
import { useStateObservable } from "@react-rxjs/core";
import { createContext, useContext, useEffect, useState } from "react";

export interface PolkaHubContext {
  polkaHub: PolkaHub;
}
export const PolkaHubContext = createContext<PolkaHubContext | null>(null);
export const usePolkaHubContext = () => {
  const ctx = useContext(PolkaHubContext);
  if (!ctx) {
    throw new Error("Missing PolkaHubContext");
  }
  return ctx;
};

const usePromise = <K, T>(
  key: K | null,
  promiseFn: (key: K) => Promise<T | null>
) => {
  const [[storedKey, storedValue], setValue] = useState<[K | null, T | null]>([
    key,
    null,
  ]);

  useEffect(() => {
    if (key === null) return;

    let cancelled = false;
    promiseFn(key).then((value) => {
      if (cancelled) return;
      setValue([key, value]);
    });

    return () => {
      cancelled = true;
    };
  }, [key, promiseFn]);

  return key === storedKey ? storedValue : null;
};

const nullProvider = async () => null;
export const useIdentity = (
  address: AccountAddress | null
): Identity | null => {
  const { polkaHub } = usePolkaHubContext();
  const getIdentity = useStateObservable(polkaHub.identityProvider$);
  return usePromise(address, getIdentity ?? nullProvider);
};

export const useBalance = (address: AccountAddress | null): Balance | null => {
  const { polkaHub } = usePolkaHubContext();
  const getBalance = useStateObservable(polkaHub.balanceProvider$);
  return usePromise(address, getBalance ?? nullProvider);
};

export const usePlugin = <T extends Plugin<any>>(id: string): T | null => {
  const { polkaHub } = usePolkaHubContext();
  return useStateObservable(polkaHub.plugin$(id));
};
