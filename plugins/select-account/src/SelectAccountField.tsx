import { AddressIdentity, useAvailableAccounts } from "@polkahub/context";
import {
  AccountPicker as AccountPickerComponent,
  cn,
} from "@polkahub/ui-components";
import { type FC } from "react";
import { useSelectedAccount } from "./provider";

const groupLabels: Record<string, string> = {
  ledger: "Ledger",
  multisig: "Multisig",
  proxy: "Proxy",
  readonly: "Read Only",
  "polkadot-vault": "Vault",
  walletconnect: "Wallet Connect",
};

export const SelectAccountField: FC<{
  className?: string;
}> = ({ className }) => {
  const availableAccounts = useAvailableAccounts();
  const [account, setAccount] = useSelectedAccount();

  const groups = Object.entries(availableAccounts)
    .filter(([, accounts]) => accounts.length > 0)
    .map(([key, accounts]) => ({
      name: groupLabels[key] ?? key,
      accounts,
    }));

  if (!groups.length && !account) return null;

  return (
    <div>
      <h3 className="font-medium">Select Account</h3>
      <AccountPickerComponent
        value={account}
        onChange={setAccount}
        groups={groups}
        className={cn(className, "max-w-auto")}
        renderAddress={(account) => (
          <AddressIdentity
            addr={account.address}
            name={account?.name}
            copyable={false}
          />
        )}
      />
    </div>
  );
};
