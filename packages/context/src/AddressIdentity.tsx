import { AccountDisplay } from "@polkadot-api/react-components";
import { FC } from "react";
import { useIdentity } from "./polkahubContext";

export const AddressIdentity: FC<{
  addr: string;
  name?: string;
  copyable?: boolean;
  className?: string;
}> = ({ addr, name, className, copyable = true }) => {
  let identity = useIdentity(addr);

  return (
    <AccountDisplay
      account={{
        address: addr,
        name: identity?.name ?? name,
        subId: identity?.subId,
        verified: identity?.verified,
      }}
      className={className}
      copyable={copyable}
      maxAddrLength={12}
    />
  );
};
