import {
  AddressBalance,
  AddressIdentity,
  ModalContext,
  useModalContext,
  usePlugin,
} from "@polkahub/context";
import { Button, SourceButton } from "@polkahub/ui-components";
import { useStateObservable } from "@react-rxjs/core";
import { CirclePlus, Trash2, Users } from "lucide-react";
import { useContext, type FC } from "react";
import { AddIndexedMultisig, GetMultisigDetails } from "./AddIndexedMultisig";
import { AddManualMultisig } from "./AddManualMultisig";
import { MultisigProvider, multisigProviderId } from "./provider";
import { useSetSelectedAccount } from "@polkahub/select-account";

export const ManageMultisig: FC<{
  getMultisigDetails?: GetMultisigDetails;
}> = (props) => {
  const { pushContent } = useContext(ModalContext)!;
  const multisigProvider = usePlugin<MultisigProvider>(multisigProviderId);

  return (
    <SourceButton
      label="Multisig"
      onClick={() =>
        pushContent({
          title: "Multisig accounts",
          element: <ManageAddresses {...props} />,
        })
      }
      disabled={!multisigProvider}
    >
      <div>
        <Users className="size-10" />
      </div>
    </SourceButton>
  );
};

const ManageAddresses: FC<{ getMultisigDetails?: GetMultisigDetails }> = ({
  getMultisigDetails,
}) => {
  const { pushContent } = useModalContext();
  const multisigProvider = usePlugin<MultisigProvider>(multisigProviderId)!;
  const multisigAccounts = useStateObservable(multisigProvider.accounts$);
  const setAccount = useSetSelectedAccount();

  return (
    <div className="space-y-4">
      {multisigAccounts.length ? (
        <div>
          <h3 className="font-medium text-muted-foreground">Added addresses</h3>
          <ul className="space-y-2">
            {multisigAccounts.map((account, i) => (
              <li key={i} className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  className="text-destructive"
                  type="button"
                  onClick={() =>
                    multisigProvider.removeMultisig(account.address)
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
      <div className="flex justify-end gap-2">
        {getMultisigDetails ? (
          <Button
            type="button"
            onClick={() =>
              pushContent({
                title: "Add Multisig",
                element: (
                  <AddIndexedMultisig getMultisigDetails={getMultisigDetails} />
                ),
              })
            }
          >
            <CirclePlus />
            Indexed
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() =>
            pushContent({
              title: "Add Multisig",
              element: <AddManualMultisig />,
            })
          }
        >
          <CirclePlus />
          {getMultisigDetails ? "Manual" : "Multisig"}
        </Button>
      </div>
    </div>
  );
};
