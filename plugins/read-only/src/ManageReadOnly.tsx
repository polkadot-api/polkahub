import {
  AddressBalance,
  AddressIdentity,
  ModalContext,
  useAvailableAccounts,
  usePlugin,
} from "@polkahub/context";
import { AccountAddress } from "@polkahub/plugin";
import { useSetSelectedAccount } from "@polkahub/select-account";
import {
  Button,
  InlineAddressInput,
  Input,
  SourceButton,
} from "@polkahub/ui-components";
import { Eye, Trash2 } from "lucide-react";
import { useContext, useState, type FC } from "react";
import { ReadOnlyProvider, readOnlyProviderId } from "./provider";

export const ManageReadOnly: FC = () => {
  const { pushContent } = useContext(ModalContext)!;
  const readOnlyProvider = usePlugin<ReadOnlyProvider>(readOnlyProviderId);

  return (
    <SourceButton
      label="Address"
      onClick={() =>
        pushContent({
          title: "Read-only accounts",
          element: <ManageAddresses />,
        })
      }
      disabled={!readOnlyProvider}
    >
      <div>
        <Eye className="size-10" />
      </div>
    </SourceButton>
  );
};

const ManageAddresses = () => {
  const [address, setAddress] = useState<AccountAddress | null>(null);
  const [name, setName] = useState("");
  const availableAccounts = useAvailableAccounts();
  const readOnlyProvider = usePlugin<ReadOnlyProvider>(readOnlyProviderId)!;
  const readOnlyAccounts = availableAccounts[readOnlyProviderId] ?? [];
  const setAccount = useSetSelectedAccount();

  return (
    <div className="space-y-4">
      <form
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!address) return;
          readOnlyProvider.addAccount(address);
          setAddress(null);
        }}
      >
        <h3 className="font-medium text-muted-foreground">
          Add read-only address
        </h3>
        <div className="flex gap-2 items-center">
          <InlineAddressInput
            name="address"
            value={address}
            onChange={setAddress}
            className="shrink-[2]"
          />
          <Input
            name="name"
            value={name}
            onChange={(evt) => setName(evt.target.value)}
            placeholder="Name (optional)"
            className="shrink-[3]"
          />
          <Button disabled={!address}>Add</Button>
        </div>
      </form>
      {readOnlyAccounts.length ? (
        <div>
          <h3 className="font-medium text-muted-foreground">Added addresses</h3>
          <ul className="space-y-2">
            {readOnlyAccounts.map((account, i) => (
              <li key={i} className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  className="text-destructive"
                  type="button"
                  onClick={() =>
                    readOnlyProvider.removeAccount(account.address)
                  }
                >
                  <Trash2 />
                </Button>
                <AddressIdentity addr={account.address} />
                <div className="grow" />
                <AddressBalance addr={account.address} />
                {setAccount ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAccount(account);
                    }}
                  >
                    Select
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
