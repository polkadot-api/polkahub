import {
  getMultisigSigner,
  MultisigSignerOptions,
} from "@polkadot-api/meta-signers";
import {
  AccountId,
  FixedSizeBinary,
  getMultisigAccountId,
  getSs58AddressInfo,
} from "@polkadot-api/substrate-bindings";
import {
  Account,
  AccountAddress,
  addrEq,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
  SerializableAccount,
} from "@polkahub/plugin";
import { DefaultedStateObservable, state } from "@react-rxjs/core";
import { Binary, PolkadotSigner } from "polkadot-api";
import {
  BehaviorSubject,
  combineLatest,
  filter,
  firstValueFrom,
  map,
  switchMap,
  timeout,
} from "rxjs";

export interface MultisigInfo {
  threshold: number;
  signatories: AccountAddress[];
  // If not set, it will be a read-only account.
  // But with the advantage that it will still figure out the resulting address
  parentSigner?: SerializableAccount;
  name?: string;
}

export type CreateMultisigSigner = (
  info: MultisigInfo,
  parentSigner: PolkadotSigner
) => PolkadotSigner;

export const multisigProviderId = "multisig";
export interface MultisigAccount extends Account {
  provider: "multisig";
  info: MultisigInfo;
}

export interface MultisigProvider extends Plugin<MultisigAccount> {
  id: "multisig";
  accounts$: DefaultedStateObservable<MultisigAccount[]>;

  setMultisigs: (multisigs: MultisigInfo[]) => void;
  addMultisig: (multisig: MultisigInfo) => Promise<MultisigAccount>;
  removeMultisig: (addr: AccountAddress) => void;
}

export const createMultisigProvider = (
  createMultisigSigner: CreateMultisigSigner,
  opts?: Partial<{
    persist: PersistenceProvider;
  }>
): MultisigProvider => {
  const { persist } = {
    persist: localStorageProvider("multisigs"),
    ...opts,
  };

  const [persistedAccounts$, setPersistedAccounts] = persistedState(
    persist,
    [] as MultisigInfo[]
  );
  const plugins$ = new BehaviorSubject<Plugin<Account>[]>([]);

  const getAccount = (
    info: MultisigInfo,
    parentSigner: PolkadotSigner | undefined
  ): MultisigAccount => ({
    provider: multisigProviderId,
    address: getMultisigAddress(info),
    signer: parentSigner ? createMultisigSigner(info, parentSigner) : undefined,
    info,
    name: info.name,
  });

  const multisigInfoToAccount = async (info: MultisigInfo) => {
    if (!info.parentSigner) return getAccount(info, undefined);

    try {
      const plugin = await firstValueFrom(
        plugins$.pipe(
          map((plugins) =>
            plugins.find((p) => info.parentSigner?.provider === p.id)
          ),
          filter((v) => v != null),
          timeout({
            first: 3000,
          })
        )
      );
      if (!plugin) return getAccount(info, undefined);

      const parentSigner = await plugin.deserialize(info.parentSigner);
      return getAccount(info, parentSigner?.signer);
    } catch (ex) {
      console.error(ex);
      return getAccount(info, undefined);
    }
  };

  const accounts$ = state(
    combineLatest([persistedAccounts$, plugins$]).pipe(
      switchMap(
        async ([accounts]) =>
          await Promise.all(accounts.map(multisigInfoToAccount))
      )
    ),
    []
  );

  return {
    id: multisigProviderId,
    deserialize: (account) => {
      const extra = account.extra as MultisigInfo;
      return multisigInfoToAccount(extra);
    },
    serialize: ({ address, info, provider }) => ({
      address,
      provider,
      extra: info,
    }),
    eq: (a, b) =>
      addrEq(a.address, b.address) &&
      addrEq(a.info.parentSigner?.address, b.info.parentSigner?.address),
    accounts$,
    receiveContext: (ctx) => plugins$.next(ctx.plugins),
    subscription$: accounts$,
    setMultisigs: setPersistedAccounts,
    addMultisig: (multisig) => {
      const addr = getMultisigAddress(multisig);
      setPersistedAccounts((prev) => {
        if (prev.some((v) => getMultisigAddress(v) === addr)) return prev;
        return [...prev, multisig];
      });
      return multisigInfoToAccount(multisig);
    },
    removeMultisig: (addr) =>
      setPersistedAccounts((prev) =>
        prev.filter((v) => getMultisigAddress(v) !== addr)
      ),
  };
};

const getPublicKey = AccountId().enc;
const getMultisigAddress = (info: MultisigInfo) => {
  const accountId = getMultisigAccountId({
    threshold: info.threshold,
    signatories: info.signatories.map(getPublicKey),
  });
  const addrInfo = getSs58AddressInfo(info.signatories[0]);
  if (!addrInfo.isValid) {
    throw new Error("Unreachable");
  }
  return AccountId(addrInfo.ss58Format).dec(accountId);
};

export const directMultisigSigner =
  (
    getMultisigInfo: (
      multisig: AccountAddress,
      callHash: FixedSizeBinary<32>
    ) => Promise<
      | {
          when: {
            height: number;
            index: number;
          };
          approvals: Array<AccountAddress>;
        }
      | undefined
    >,
    txPaymentInfo: (
      uxt: Binary,
      len: number
    ) => Promise<{
      weight: {
        ref_time: bigint;
        proof_size: bigint;
      };
    }>,
    opts?: MultisigSignerOptions<AccountAddress>
  ): CreateMultisigSigner =>
  (info, parentSigner) =>
    getMultisigSigner(info, getMultisigInfo, txPaymentInfo, parentSigner, opts);
