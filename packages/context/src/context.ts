import { Account, Plugin } from "@polkahub/plugin";
import type { SS58String } from "polkadot-api";
import {
  createContext,
  ReactElement,
  useContext,
  useEffect,
  useState,
} from "react";

export const ModalContext = createContext<{
  setContent: (element: ReactElement | null) => void;
} | null>(null);

export interface Identity {
  value: string;
  verified: boolean;
  subId?: string;
}

export interface PolkaHubContext {
  id: string;
  plugins: Plugin[];
  getIdentity: (address: SS58String) => Promise<Identity | null>;
  availableAccounts: Record<string, Account[]>;
}
export const PolkaHubContext = createContext<PolkaHubContext | null>(null);

export const usePolkaHubContext = () => {
  const ctx = useContext(PolkaHubContext);
  if (!ctx) {
    throw new Error("Missing PolkaHubContext");
  }
  return ctx;
};

export const useIdentity = (address: SS58String | null): Identity | null => {
  const [[addrId, identity], setIdentity] = useState<
    [SS58String | null, Identity | null]
  >([address, null]);
  const { getIdentity } = usePolkaHubContext();

  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    getIdentity(address).then((identity) => {
      if (cancelled) return;
      setIdentity([address, identity]);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return addrId === address ? identity : null;
};
