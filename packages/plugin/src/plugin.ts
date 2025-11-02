import type { HexString, PolkadotSigner, SS58String } from "polkadot-api";
import type { Observable } from "rxjs";

export type AccountAddress = SS58String | HexString;

export interface Account {
  provider: string;
  address: AccountAddress;
  signer?: PolkadotSigner;
  name?: string;
}

export interface SerializableAccount<T = unknown> {
  provider: string;
  address: AccountAddress;
  name?: string;
  extra?: T;
}

export interface Plugin<A extends Account = Account> {
  id: string;

  // Methods needed by other plugins (like select account) to persist accounts from other plugins
  serialize?: (account: A) => SerializableAccount;
  deserialize: (value: SerializableAccount) => Promise<A | null> | A | null;

  // Method needed to check when an account was removed
  // Defaults to address equality
  eq?: (a: A, b: A) => boolean;

  accounts$: Observable<A[]>;
  // Defaults to Record<id, accounts$>
  accountGroups$?: Observable<Record<string, A[]>>;

  // Hooks
  receivePlugins?: (plugins: Plugin[]) => void;
  subscription$?: Observable<unknown>;
}
