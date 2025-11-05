import { AddressIdentity, useAvailableAccounts } from "@polkahub/context";
import { Account, AccountAddress } from "@polkahub/plugin";
import { AddressInput as AddressInputComponent } from "@polkahub/ui-components";
import { FC, useMemo } from "react";

export const AddressInput: FC<{
  value: AccountAddress | null;
  onChange: (value: AccountAddress | null) => void;
  className?: string;
}> = ({ className, value, onChange }) => {
  const availableAccounts = useAvailableAccounts();

  const hints = useMemo(() => {
    const addressToAccounts: Record<AccountAddress, Account[]> = {};
    Object.values(availableAccounts)
      .flat()
      .forEach((acc) => {
        addressToAccounts[acc.address] ??= [];
        addressToAccounts[acc.address].push(acc);
      });

    return Object.values(addressToAccounts).map((group) =>
      group.reduce((acc, v) =>
        (v.name?.length ?? 0) > (acc.name?.length ?? 0) ? v : acc
      )
    );
  }, [availableAccounts]);

  return (
    <AddressInputComponent
      value={value}
      onChange={onChange}
      className={className}
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
    />
  );
};
