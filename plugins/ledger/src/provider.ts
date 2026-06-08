import type Transport from "@ledgerhq/hw-transport"
import { LedgerSigner } from "@polkadot-api/ledger-signer"
import {
  Account,
  AccountAddress,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin"
import { DefaultedStateObservable, withDefault } from "@react-rxjs/core"
import { AccountId } from "polkadot-api"
import {
  catchError,
  combineLatest,
  concatMap,
  finalize,
  from,
  map,
  Observable,
  switchMap,
} from "rxjs"

export const ledgerProviderId = "ledger"

type LedgerTxCreator = Awaited<ReturnType<LedgerSigner["getTxCreator"]>>

export interface LedgerAccountInfo {
  address: AccountAddress
  deviceId: number
  index: number
}
export interface LedgerAccount extends Account<LedgerTxCreator> {
  provider: "ledger"
  deviceId: number
  index: number
  txCreator: LedgerTxCreator
}

export interface LedgerProvider extends Plugin<LedgerAccount> {
  id: "ledger"
  accounts$: DefaultedStateObservable<LedgerAccount[]>

  setAccounts: (payload: LedgerAccountInfo[]) => void
  addAccount: (payload: LedgerAccountInfo) => LedgerAccount
  removeAccount: (payload: LedgerAccountInfo) => void

  getLedgerAccounts$: (idx: Array<number>) => Observable<LedgerAccountInfo>
}

export type NetworkInfo = {
  decimals: number
  tokenSymbol: string
}

export const createLedgerProvider = (
  createTransport: () => Promise<Transport>,
  getNetworkInfo: () => Promise<NetworkInfo>,
  opts?: Partial<{
    persist: PersistenceProvider
  }>,
): LedgerProvider => {
  const { persist } = {
    persist: localStorageProvider("ledger-acc"),
    ...opts,
  }
  let ss58Format = 42

  const [ledgerAccounts$, setLedgerAccounts] = persistedState(
    persist,
    [] as LedgerAccountInfo[],
  )

  const getLedgerAccounts$ = (
    idxs: Array<number>,
  ): Observable<LedgerAccountInfo> =>
    from(initializeLedgerSigner(createTransport)).pipe(
      switchMap((ledger) =>
        combineLatest({
          ledger: [ledger],
          deviceId: ledger.ledgerSigner.deviceId(),
        }).pipe(
          catchError((ex) => {
            ledger.close()
            throw ex
          }),
        ),
      ),
      switchMap(({ ledger, deviceId }) =>
        from(idxs).pipe(
          concatMap(async (idx) => {
            const pk = await ledger.ledgerSigner.getPubkey(idx)
            return {
              address: AccountId(ss58Format).dec(pk),
              deviceId,
              index: idx,
            }
          }),
          finalize(() => ledger.close()),
        ),
      ),
    )

  const createLedgerSigner = (account: LedgerAccountInfo): LedgerTxCreator => {
    const publicKey = AccountId().enc(account.address)

    const operateWithSigner = async <R>(
      cb: (signer: LedgerTxCreator) => Promise<R>,
    ) => {
      const { ledgerSigner, close } =
        await initializeLedgerSigner(createTransport)
      try {
        const info = await getNetworkInfo()

        const signer = await ledgerSigner.getTxCreator(info, account.index)
        if (!pkAreEq(publicKey, signer.publicKey)) {
          throw new Error("Device mismatch")
        }

        return await cb(signer)
      } finally {
        close()
      }
    }
    const creatorWithSigner =
      (
        ...factoryArgs: Parameters<LedgerTxCreator>
      ): ReturnType<LedgerTxCreator> =>
      (...args) =>
        operateWithSigner((factory) => factory(...factoryArgs)(...args))

    return Object.assign(creatorWithSigner, {
      // ArrayBuffer mismatch
      publicKey: publicKey as any,
      signBytes: (...args: Parameters<LedgerTxCreator["signBytes"]>) =>
        operateWithSigner((signer) => signer.signBytes(...args)),
    })
  }

  const toAccount = (info: LedgerAccountInfo): LedgerAccount => ({
    provider: ledgerProviderId,
    ...info,
    txCreator: createLedgerSigner(info),
  })

  const accounts$ = ledgerAccounts$.pipeState(
    map((accounts) => accounts.map(toAccount)),
    withDefault([]),
  )

  const accountEq = (a: LedgerAccountInfo, b: LedgerAccountInfo) =>
    a.deviceId === b.deviceId && a.index === b.index
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
        const set = new Set(v)
        set.add(account)
        return [...set]
      })
      return toAccount(account)
    },
    removeAccount: (account) =>
      setLedgerAccounts((v) => v.filter((acc) => !accountEq(acc, account))),
    getLedgerAccounts$,
    receiveContext(context) {
      ss58Format = context.ss58Format
    },
  }
}

const pkAreEq = (a: Uint8Array, b: Uint8Array) => a.every((v, i) => b[i] === v)

export class AlreadyInUseError extends Error {
  constructor() {
    super("Device already in use")
  }
}

let usingLedger = false
async function initializeLedgerSigner(
  createTransport: () => Promise<Transport>,
) {
  if (!(globalThis as any).Buffer) {
    const bufferModule = await import("buffer")
    ;(globalThis as any).Buffer =
      bufferModule.default?.Buffer ?? bufferModule.Buffer
  }

  if (usingLedger) throw new AlreadyInUseError()
  usingLedger = true

  let transport: Transport
  try {
    transport = await createTransport()
  } catch (ex) {
    usingLedger = false
    throw ex
  }

  const close = () => {
    usingLedger = false
    transport.close()
  }

  try {
    const ledgerSigner = new LedgerSigner(transport)
    return { ledgerSigner, transport, close }
  } catch (ex) {
    close()
    throw ex
  }
}
