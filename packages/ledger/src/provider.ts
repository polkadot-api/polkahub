import type Transport from "@ledgerhq/hw-transport";
import { LedgerSigner } from "@polkadot-api/ledger-signer";
import {
  Account,
  AccountAddress,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin";
import { DefaultedStateObservable, withDefault } from "@react-rxjs/core";
import { AccountId, type PolkadotSigner } from "polkadot-api";
import {
  catchError,
  combineLatest,
  concatMap,
  finalize,
  from,
  map,
  Observable,
  switchMap,
} from "rxjs";

export const ledgerProviderId = "ledger";

export interface LedgerAccountInfo {
  address: AccountAddress;
  deviceId: number;
  index: number;
}
export interface LedgerAccount extends Account {
  provider: "ledger";
  deviceId: number;
  index: number;
}

export interface LedgerProvider extends Plugin<LedgerAccount> {
  id: "ledger";
  accounts$: DefaultedStateObservable<LedgerAccount[]>;

  setAccounts: (payload: LedgerAccountInfo[]) => void;
  addAccount: (payload: LedgerAccountInfo) => LedgerAccount;
  removeAccount: (payload: LedgerAccountInfo) => void;

  getLedgerAccounts$: (idx: Array<number>) => Observable<LedgerAccountInfo>;
}

export type NetworkInfo = {
  ss58Format: number;
  decimals: number;
  tokenSymbol: string;
};

export const createLedgerProvider = (
  createTransport: () => Promise<Transport>,
  getNetworkInfo: () => Promise<NetworkInfo>,
  opts?: Partial<{
    persist: PersistenceProvider;
  }>
): LedgerProvider => {
  const { persist } = {
    persist: localStorageProvider("ledger-acc"),
    ...opts,
  };

  const [ledgerAccounts$, setLedgerAccounts] = persistedState(
    persist,
    [] as LedgerAccountInfo[]
  );

  const getLedgerAccounts$ = (
    idxs: Array<number>
  ): Observable<LedgerAccountInfo> =>
    from(initializeLedgerSigner(createTransport)).pipe(
      switchMap((ledger) =>
        combineLatest({
          ledger: [ledger],
          deviceId: ledger.ledgerSigner.deviceId(),
          ss58Format: getNetworkInfo().then((r) => r.ss58Format),
        }).pipe(
          catchError((ex) => {
            ledger.close();
            throw ex;
          })
        )
      ),
      switchMap(({ ledger, deviceId, ss58Format }) =>
        from(idxs).pipe(
          concatMap(async (idx) => {
            const pk = await ledger.ledgerSigner.getPubkey(idx);
            return {
              address: AccountId(ss58Format).dec(pk),
              deviceId,
              index: idx,
            };
          }),
          finalize(() => ledger.close())
        )
      )
    );

  const createLedgerSigner = (account: LedgerAccountInfo): PolkadotSigner => {
    const publicKey = AccountId().enc(account.address);

    const operateWithSigner = async <R>(
      cb: (signer: PolkadotSigner) => Promise<R>
    ) => {
      const { ledgerSigner, close } = await initializeLedgerSigner(
        createTransport
      );
      try {
        const info = await getNetworkInfo();

        const signer = await ledgerSigner.getPolkadotSigner(
          info,
          account.index
        );
        if (!pkAreEq(publicKey, signer.publicKey)) {
          throw new Error("Device mismatch");
        }

        return await cb(signer);
      } finally {
        close();
      }
    };

    return {
      publicKey,
      signBytes: (...args) =>
        operateWithSigner((signer) => signer.signBytes(...args)),
      signTx: (...args) =>
        operateWithSigner((signer) => signer.signTx(...args)),
    };
  };

  const toAccount = (info: LedgerAccountInfo): LedgerAccount => ({
    provider: ledgerProviderId,
    ...info,
    signer: createLedgerSigner(info),
  });

  const accounts$ = ledgerAccounts$.pipeState(
    map((accounts) => accounts.map(toAccount)),
    withDefault([])
  );

  const accountEq = (a: LedgerAccountInfo, b: LedgerAccountInfo) =>
    a.deviceId === b.deviceId && a.index === b.index;
  return {
    id: ledgerProviderId,
    deserialize: (acc) =>
      toAccount({
        address: acc.address,
        deviceId: (acc.extra as LedgerAccountInfo).deviceId,
        index: (acc.extra as LedgerAccountInfo).index,
      }),
    serialize: ({ address, deviceId, index, provider }) => ({
      address,
      provider,
      extra: { deviceId, index },
    }),
    eq: accountEq,
    accounts$,
    setAccounts: setLedgerAccounts,
    addAccount: (account) => {
      setLedgerAccounts((v) => {
        const set = new Set(v);
        set.add(account);
        return [...set];
      });
      return toAccount(account);
    },
    removeAccount: (account) =>
      setLedgerAccounts((v) => v.filter((acc) => !accountEq(acc, account))),
    getLedgerAccounts$,
  };
};

const pkAreEq = (a: Uint8Array, b: Uint8Array) => a.every((v, i) => b[i] === v);

export class AlreadyInUseError extends Error {
  constructor() {
    super("Device already in use");
  }
}

let usingLedger = false;
async function initializeLedgerSigner(
  createTransport: () => Promise<Transport>
) {
  if (!globalThis.Buffer) {
    const bufferModule = await import("buffer");
    globalThis.Buffer = bufferModule.Buffer;
  }

  if (usingLedger) throw new AlreadyInUseError();
  usingLedger = true;

  let transport: Transport;
  try {
    transport = await createTransport();
  } catch (ex) {
    usingLedger = false;
    throw ex;
  }

  const close = () => {
    usingLedger = false;
    transport.close();
  };

  try {
    const ledgerSigner = new LedgerSigner(transport);
    return { ledgerSigner, transport, close };
  } catch (ex) {
    close();
    throw ex;
  }
}
