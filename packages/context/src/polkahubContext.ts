import {
  ss58Reformat,
  type AccountAddress,
  type Plugin,
} from "@polkahub/plugin";
import type { Balance, Identity, PolkaHub } from "@polkahub/state";
import { useStateObservable } from "@react-rxjs/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { from, Observable, of } from "rxjs";

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

const useAsync = <K, T>(
  key: K | null,
  asyncFn: (key: K) => Observable<T | null>
) => {
  const [[storedKey, storedValue], setValue] = useState<[K | null, T | null]>([
    key,
    null,
  ]);

  useEffect(() => {
    if (key === null) return;

    const asyncValue = asyncFn(key);
    const sub = from(asyncValue).subscribe({
      next: (value) => {
        setValue([key, value]);
      },
      error: (ex) => {
        console.error(ex);
      },
    });

    return () => sub.unsubscribe();
  }, [key, asyncFn]);

  return key === storedKey ? storedValue : null;
};

const nullProvider = () => of(null);
export const useIdentity = (
  address: AccountAddress | null
): Identity | null => {
  const { polkaHub } = usePolkaHubContext();
  const getIdentity = useStateObservable(polkaHub.identityProvider$);
  return useAsync(address, getIdentity ?? nullProvider);
};

export const useBalance = (address: AccountAddress | null): Balance | null => {
  const { polkaHub } = usePolkaHubContext();
  const getBalance = useStateObservable(polkaHub.balanceProvider$);
  return useAsync(address, getBalance ?? nullProvider);
};

export const usePlugin = <T extends Plugin<any>>(id: string): T | null => {
  const { polkaHub } = usePolkaHubContext();
  return useStateObservable(polkaHub.plugin$(id));
};

export const useSS58Format = () => {
  const { polkaHub } = usePolkaHubContext();
  return useStateObservable(polkaHub.ss58Format$);
};
export const useSS58Formatter = () => {
  const format = useSS58Format();
  return useCallback(
    (address: AccountAddress): AccountAddress => {
      try {
        return ss58Reformat(address, format);
      } catch (ex) {
        return address;
      }
    },
    [format]
  );
};
