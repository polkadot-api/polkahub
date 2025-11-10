import { AccountDisplay } from "@polkadot-api/react-components";
import {
  addrEq,
  AddressInput,
  ManageLedger,
  ManageMultisig,
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
          <ManageProxy />
          <ManageMultisig
            getMultisigDetails={async (addr) => {
              console.log("gmd", addr);
              if (
                addrEq("12R1XCdgkHysv8Y4ntiXguo4eUYHXjQTmfRjL8FbmezsG71j", addr)
              ) {
                return {
                  addresses: [
                    "15roJ4ZrgrZam5BQWJgiGHpgp7ShFQBRNLq6qUfiNqXDZjMK",
                    "16AQJHpSRMh5X1mULm4dCgYxrQLsrnK3uwCQ436iitYk1ru7",
                    "16JGzEsi8gcySKjpmxHVrkLTHdFHodRepEz8n244gNZpr9J",
                  ],
                  threshold: 2,
                };
              }
              return null;
            }}
          />
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
