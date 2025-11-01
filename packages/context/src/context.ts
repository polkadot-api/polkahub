import { Account, Plugin } from "@polkahub/plugin";
import type { SS58String } from "polkadot-api";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface ModalContext {
  closeModal: () => void;
  replaceContent: (element: { title?: string; element: ReactNode }) => void;
  pushContent: (element: { title?: string; element: ReactNode }) => void;
  popContent: () => void;
}
export const ModalContext = createContext<ModalContext | null>(null);

export interface Identity {
  value: string;
  verified: boolean;
  subId?: string;
}

export interface PolkaHubContext {
  id: string;
  plugins: Plugin[];
  getIdentity: (address: SS58String) => Promise<Identity | null>;
  getBalance: (address: SS58String) => Promise<string | null>;
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

export const useIdentity = (address: SS58String | null): Identity | null => {
  const { getIdentity } = usePolkaHubContext();
  return usePromise(address, getIdentity);
};

export const useBalance = (address: SS58String | null): string | null => {
  const { getBalance } = usePolkaHubContext();
  return usePromise(address, getBalance);
};

export const usePlugin = <T extends Plugin<any>>(id: string): T | undefined => {
  const ctx = useContext(PolkaHubContext);
  return useMemo(
    () => ctx?.plugins.find((p) => p.id === id) as T | undefined,
    [id, ctx]
  );
};

export interface AvailableAccountsContext {
  availableAccounts: Record<string, Account[]>;
}
export const AvailableAccountsContext =
  createContext<AvailableAccountsContext | null>(null);
export const useAvailableAccounts = () => {
  const ctx = useContext(AvailableAccountsContext);
  return ctx?.availableAccounts ?? {};
};
