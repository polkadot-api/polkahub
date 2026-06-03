import { AccountDisplay } from "@polkadot-api/react-components"
import { FC, useContext } from "react"
import { MaxAddrLengthContext } from "./modalContext"
import { useIdentity, useSS58Formatter } from "./polkahubContext"

export const AddressIdentity: FC<{
  addr: string
  name?: string
  copyable?: boolean
  className?: string
}> = ({ addr, name, className, copyable = true }) => {
  const formatSS58 = useSS58Formatter()
  let identity = useIdentity(addr)
  const maxAddrLength = useContext(MaxAddrLengthContext)

  return (
    <AccountDisplay
      account={{
        address: formatSS58(addr),
        name: identity?.name ?? name,
        subId: identity?.subId,
        verified: identity?.verified,
      }}
      className={className}
      copyable={copyable}
      maxAddrLength={maxAddrLength}
    />
  )
}
