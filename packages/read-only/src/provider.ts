import {
  Account,
  AccountAddress,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin";
import { DefaultedStateObservable, withDefault } from "@react-rxjs/core";
import { AccountId } from "polkadot-api";
import { getPolkadotSigner } from "polkadot-api/signer";
import { map } from "rxjs";

export const readOnlyProviderId = "readonly";
export interface ReadOnlyProvider extends Plugin {
  id: "readonly";
  accounts$: DefaultedStateObservable<Account[]>;
  setAccounts: (payload: AccountAddress[]) => void;
  addAccount: (address: AccountAddress) => Account;
  removeAccount: (address: AccountAddress) => void;
  toAccount: (address: AccountAddress) => Account;
}

export const createReadOnlyProvider = (
  opts?: Partial<{
    fakeSigner: boolean;
    persist: PersistenceProvider;
  }>
): ReadOnlyProvider => {
  const { fakeSigner, persist } = {
    fakeSigner: false,
    persist: localStorageProvider("readonly-accounts"),
    ...opts,
  };

  const [persistedAccounts$, setPersistedAccounts] = persistedState(
    persist,
    [] as AccountAddress[]
  );

  const getAccount = (address: AccountAddress): Account => ({
    provider: readOnlyProviderId,
    address,
    signer: fakeSigner ? createFakeSigner(address) : undefined,
  });

  const accounts$ = persistedAccounts$.pipeState(
    map((accounts) => accounts.map(getAccount)),
    withDefault([])
  );

  return {
    id: readOnlyProviderId,
    deserialize: (acc) => getAccount(acc.address),
    accounts$,
    setAccounts: setPersistedAccounts,
    addAccount: (addr) => {
      setPersistedAccounts((v) => {
        const set = new Set(v);
        set.add(addr);
        return [...set];
      });
      return getAccount(addr);
    },
    removeAccount: (addr) =>
      setPersistedAccounts((v) => v.filter((acc) => acc !== addr)),
    toAccount: getAccount,
  };
};

const createFakeSigner = (address: AccountAddress) =>
  getPolkadotSigner(AccountId().enc(address)!, "Sr25519", () => {
    // From https://wiki.acala.network/build/sdks/homa
    const signature = new Uint8Array(64);
    signature.fill(0xcd);
    signature.set([0xde, 0xad, 0xbe, 0xef]);
    return signature;
  });
