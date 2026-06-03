import { AddressIdentity, useAvailableAccounts } from "@polkahub/context"
import { Account, AccountAddress } from "@polkahub/plugin"
import { AddressInput as AddressInputComponent } from "@polkahub/ui-components"
import { getSs58AddressInfo } from "polkadot-api"
import { FC, useMemo } from "react"

export const AddressInput: FC<{
  value?: AccountAddress | null
  onChange?: (value: AccountAddress | null) => void
  disableClear?: boolean
  className?: string
  triggerClassName?: string
  format?: "ss58" | "eth"
}> = (props) => {
  const { format } = props
  const availableAccounts = useAvailableAccounts()

  const hints = useMemo(() => {
    const addressToAccounts: Record<AccountAddress, Account[]> = {}
    Object.values(availableAccounts)
      .flat()
      .forEach((acc) => {
        if (
          (format === "ss58" && !getSs58AddressInfo(acc.address).isValid) ||
          (format === "eth" &&
            !(acc.address.startsWith("0x") && acc.address.length === 42))
        )
          return
        addressToAccounts[acc.address] ??= []
        addressToAccounts[acc.address].push(acc)
      })

    return Object.values(addressToAccounts).map((group) =>
      group.reduce((acc, v) =>
        (v.name?.length ?? 0) > (acc.name?.length ?? 0) ? v : acc,
      ),
    )
  }, [availableAccounts, format])

  return (
    <AddressInputComponent
      hinted={Object.values(hints).flat()}
      renderAddress={(account: Account | string) =>
        typeof account === "string" ? (
          <AddressIdentity addr={account} copyable={false} />
        ) : (
          <AddressIdentity
            addr={account.address}
            name={account?.name}
            copyable={false}
          />
        )
      }
      {...props}
    />
  )
}
