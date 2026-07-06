import { AddressIdentity, useAvailableAccounts } from "@polkahub/context"
import {
  AccountPicker as AccountPickerComponent,
  cn,
} from "@polkahub/ui-components"
import { type FC } from "react"
import { useSelectedAccount } from "./provider"

const groupLabels: Record<string, string> = {
  ledger: "Ledger",
  multisig: "Multisig",
  proxy: "Proxy",
  readonly: "Read Only",
  "polkadot-vault": "Vault",
  walletconnect: "Wallet Connect",
}

export const SelectAccountField: FC<{
  className?: string
  disableClear?: boolean
}> = (props) => {
  const availableAccounts = useAvailableAccounts()
  const [account] = useSelectedAccount()

  if (
    !account &&
    !Object.values(availableAccounts).some((group) => group.length > 0)
  )
    return null

  return (
    <div>
      <h3 className="font-medium">Select Account</h3>
      <SelectAccount {...props} />
    </div>
  )
}

export const SelectAccount: FC<{
  className?: string
  disableClear?: boolean
}> = ({ className, disableClear }) => {
  const availableAccounts = useAvailableAccounts()
  const [account, setAccount] = useSelectedAccount()

  const groups = Object.entries(availableAccounts)
    .filter(([, accounts]) => accounts.length > 0)
    .map(([key, accounts]) => ({
      name: groupLabels[key] ?? key,
      accounts,
    }))

  return (
    <AccountPickerComponent
      value={account}
      onChange={setAccount}
      groups={groups}
      className={cn(className, "max-w-auto")}
      disableClear={disableClear}
      renderAddress={(account) => (
        <AddressIdentity
          addr={account.address}
          name={account?.name}
          copyable={false}
        />
      )}
    />
  )
}
