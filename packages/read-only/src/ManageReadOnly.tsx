import {
  AddressBalance,
  AddressIdentity,
  ModalContext,
  useAvailableAccounts,
  usePlugin,
} from "@polkahub/context";
import { useSetSelectedAccount } from "@polkahub/select-account";
import { Button, Input, SourceButton } from "@polkahub/ui-components";
import { Eye, Trash2 } from "lucide-react";
import { getSs58AddressInfo } from "polkadot-api";
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
  const [addressInput, setAddressInput] = useState("");
  const availableAccounts = useAvailableAccounts();
  const readOnlyProvider = usePlugin<ReadOnlyProvider>(readOnlyProviderId)!;
  const readOnlyAccounts = availableAccounts[readOnlyProviderId] ?? [];
  const setAccount = useSetSelectedAccount();

  const isAddrValid = (() => {
    try {
      return getSs58AddressInfo(addressInput).isValid;
    } catch {
      return false;
    }
  })();

  return (
    <div className="space-y-4">
      <form
        onSubmit={(evt) => {
          evt.preventDefault();
          if (!isAddrValid) return;
          const added = readOnlyProvider.addAccount(addressInput);

          setAccount?.(added);
          setAddressInput("");
        }}
      >
        <h3 className="font-medium text-muted-foreground">
          Add read-only address
        </h3>
        <div className="flex gap-2 items-center">
          <Input
            name="address"
            value={addressInput}
            onChange={(evt) => setAddressInput(evt.target.value)}
          />
          <Button disabled={!isAddrValid}>Add</Button>
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
