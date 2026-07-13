import {
  Account,
  AccountAddress,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin"
import { DefaultedStateObservable, withDefault } from "@react-rxjs/core"
import { getFakeTxCreator, getTxCreator } from "polkadot-api/signer"
import { map } from "rxjs"

export interface ReadonlyAccountInfo {
  address: AccountAddress
  name?: string
}

export const readOnlyProviderId = "readonly"
type ReadOnlyAccount = Account<ReturnType<typeof getTxCreator>>
export interface ReadOnlyProvider extends Plugin<ReadOnlyAccount> {
  id: "readonly"
  accounts$: DefaultedStateObservable<ReadOnlyAccount[]>
  setAccounts: (payload: ReadonlyAccountInfo[]) => void
  addAccount: (address: ReadonlyAccountInfo) => ReadOnlyAccount
  removeAccount: (address: AccountAddress) => void
  toAccount: (address: AccountAddress) => ReadOnlyAccount
}

export const createReadOnlyProvider = (
  opts?: Partial<{
    fakeSigner: boolean
    persist: PersistenceProvider
  }>,
): ReadOnlyProvider => {
  const { fakeSigner, persist } = {
    fakeSigner: false,
    persist: localStorageProvider("readonly-accounts"),
    ...opts,
  }

  const [persistedAccounts$, setPersistedAccounts] = persistedState(
    persist,
    [] as Array<AccountAddress> | Array<ReadonlyAccountInfo>,
  )
  const normalizeInfo = (
    value: AccountAddress | ReadonlyAccountInfo,
  ): ReadonlyAccountInfo =>
    typeof value === "string"
      ? {
          address: value,
        }
      : value

  const getAccount = ({
    address,
    name,
  }: ReadonlyAccountInfo): ReadOnlyAccount => ({
    name,
    provider: readOnlyProviderId,
    address,
    txCreator: fakeSigner ? getFakeTxCreator(address) : undefined,
  })

  const accounts$ = persistedAccounts$.pipeState(
    map((accounts) => accounts.map(normalizeInfo).map(getAccount)),
    withDefault([]),
  )

  return {
    id: readOnlyProviderId,
    deserialize: (acc) => getAccount(acc),
    accounts$,
    setAccounts: setPersistedAccounts,
    addAccount: (acc) => {
      setPersistedAccounts((v) => {
        const map = new Map(
          v.map(normalizeInfo).map((acc) => [acc.address, acc]),
        )
        map.set(acc.address, acc)
        return [...map.values()]
      })
      return getAccount(acc)
    },
    removeAccount: (addr) =>
      setPersistedAccounts(
        (v) =>
          v.filter((acc) => normalizeInfo(acc).address !== addr) as
            | ReadonlyAccountInfo[]
            | AccountAddress[],
      ),
    toAccount: (address) =>
      getAccount({
        address,
      }),
  }
}
