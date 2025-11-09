import { AccountDisplay } from "@polkadot-api/react-components";
import type { SS58String } from "polkadot-api";
import {
  AddressInput,
  ManageLedger,
  ManagePjsWallets,
  ManageProxy,
  ManageReadOnly,
  ManageVault,
  PolkaHubModal,
  SelectAccountField,
  useAvailableAccounts,
  useSelectedAccount,
  WalletConnectButton,
} from "polkahub";
import { useMemo, useState } from "react";
import { Card } from "./Card";
import { dotApi } from "./client";

function App() {
  const [value, setValue] = useState<string | null>(
    "5FxrUu1PUugUYs6HQ83bDswjGLyHYTEzm7yqmrkKVPaYe71Y"
  );

  return (
    <div className="container m-auto">
      <div className="space-y-4 p-4">
        <ConnectButton />
        <SelectedAccount />
        <AvailableAccounts />
        <AddressInput
          value={value}
          onChange={setValue}
          triggerClassName="h-9"
        />
      </div>
    </div>
  );
}

const getDelegates = async (addr: SS58String) => {
  const [result] = await dotApi.query.Proxy.Proxies.getValue(addr);
  return result;
};

const ConnectButton = () => (
  <Card className="text-center">
    <PolkaHubModal>
      <SelectAccountField />
      <ManagePjsWallets />
      <div>
        <h3>Manage Connections</h3>
        <div className="flex gap-2 flex-wrap items-center justify-center">
          <ManageReadOnly />
          <ManageLedger />
          <ManageVault />
          <WalletConnectButton />
          <ManageProxy getDelegates={getDelegates} />
        </div>
      </div>
    </PolkaHubModal>
  </Card>
);

const SelectedAccount = () => {
  const [selectedAccount, setSelectedAccount] = useSelectedAccount();

  if (!selectedAccount) {
    return <Card>No account selected</Card>;
  }

  return (
    <Card>
      <h3 className="text-sm font-bold">Selected Account</h3>
      <div className="flex justify-between items-center">
        <AccountDisplay account={selectedAccount} />
        <button
          type="button"
          onClick={() => setSelectedAccount(null)}
          className="px-2 py-1 rounded shadow text-sm bg-secondary text-secondary-foreground"
        >
          Clear
        </button>
      </div>
    </Card>
  );
};

const AvailableAccounts = () => {
  const availableAccounts = useAvailableAccounts();

  const availableAccountList = useMemo(
    () => Object.values(availableAccounts).flat(),
    [availableAccounts]
  );

  if (!availableAccountList.length) {
    return <Card>No available accounts, please connect one provider</Card>;
  }

  return (
    <Card>
      <h3 className="text-sm font-bold">Available accounts</h3>
      <ul>
        {availableAccountList.map((account, i) => (
          <li key={i}>
            <AccountDisplay account={account} />
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default App;
