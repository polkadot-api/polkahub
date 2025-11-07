import { AccountDisplay } from "@polkadot-api/react-components";
import { FC } from "react";
import { useIdentity, useSS58Formatter } from "./polkahubContext";

export const AddressIdentity: FC<{
  addr: string;
  name?: string;
  copyable?: boolean;
  className?: string;
  maxAddrLength?: number;
}> = ({ addr, name, className, maxAddrLength = 12, copyable = true }) => {
  const formatSS58 = useSS58Formatter();
  let identity = useIdentity(addr);

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
  );
};
