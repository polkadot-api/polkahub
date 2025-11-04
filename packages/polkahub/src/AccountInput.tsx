import { AddressIdentity, useAvailableAccounts } from "@polkahub/context";
import { Account } from "@polkahub/plugin";
import { AccountInput as AccountInputComponent } from "@polkahub/ui-components";
import { FC, useMemo } from "react";

export const AccountInput: FC<{
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}> = ({ className, value, onChange }) => {
  const availableAccounts = useAvailableAccounts();

  const hints = useMemo(() => {
    const addressToAccounts: Record<string, Account[]> = {};
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
    <AccountInputComponent
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
