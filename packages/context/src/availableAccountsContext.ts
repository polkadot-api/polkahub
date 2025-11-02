import type { Account } from "@polkahub/plugin";
import { createContext, useContext } from "react";

export interface AvailableAccountsContext {
  availableAccounts: Record<string, Account[]>;
}
export const AvailableAccountsContext =
  createContext<AvailableAccountsContext | null>(null);
export const useAvailableAccounts = () => {
  const ctx = useContext(AvailableAccountsContext);
  return ctx?.availableAccounts ?? {};
};
``;
