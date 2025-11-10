import {
  AddressIdentity,
  useModalContext,
  usePlugin,
  usePolkaHubContext,
} from "@polkahub/context";
import {
  AccountPicker,
  AddressInput as AddressInputComponent,
  Button,
  Input,
  Slider,
} from "@polkahub/ui-components";
import { Trash2 } from "lucide-react";
import { type FC } from "react";
import {
  AccountId,
  getMultisigAccountId,
} from "@polkadot-api/substrate-bindings";
import { useAvailableAccounts } from "@polkahub/context";
import {
  Account,
  AccountAddress,
  addrEq,
  defaultSerialize,
} from "@polkahub/plugin";
import { useMemo, useState } from "react";
import { MultisigProvider, multisigProviderId } from "./provider";

export const AddManualMultisig: FC = () => {
  const { popContent } = useModalContext();
  const multisigProvider = usePlugin<MultisigProvider>(multisigProviderId);
  const { polkaHub } = usePolkaHubContext();
  const [name, setName] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [signatories, setSignatories] = useState<AccountAddress[]>([]);
  const [threshold, setThreshold] = useState<number>(2);
  const availableAccounts = useAvailableAccounts();
  const availableSigners = useMemo(
    () =>
      Object.entries(availableAccounts)
        .map(([name, accounts]) => ({
          name,
          accounts: accounts
            .filter((acc) => !!acc.signer)
            .filter((acc) =>
              signatories.some((addr) => addrEq(addr, acc.address))
            ),
        }))
        .filter(({ accounts }) => accounts.length > 0),
    [availableAccounts, signatories]
  );

  const multisigAddress = useMemo(() => {
    if (threshold > signatories.length) return null;
    const [enc, dec] = AccountId();

    try {
      return dec(
        getMultisigAccountId({
          threshold,
          signatories: signatories.map(enc),
        })
      );
    } catch (ex) {
      console.error(ex);
      return null;
    }
  }, [signatories, threshold]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (evt) => {
        evt.preventDefault();
        if (!multisigAddress || !selectedAccount) return null;

        const plugins = polkaHub.plugins$.getValue();
        const parentProvider = plugins.find(
          (p) => p.id === selectedAccount.provider
        );
        if (!parentProvider)
          throw new Error(
            `Parent provider ${selectedAccount.provider} not found`
          );

        const serializeFn = parentProvider.serialize ?? defaultSerialize;

        multisigProvider?.addMultisig({
          signatories,
          threshold,
          parentSigner: serializeFn(selectedAccount),
          name: name.trim() ? name.trim() : undefined,
        });

        popContent();
      }}
    >
      <div className="space-y-2">
        <h3 className="font-medium text-muted-foreground">Add signatories</h3>
        <ul>
          {signatories.map((sig) => (
            <li key={sig} className="flex gap-2 items-center">
              <Button
                variant="outline"
                className="text-destructive"
                type="button"
                onClick={() => {
                  setThreshold((thr) =>
                    Math.max(2, Math.min(thr, signatories.length - 1))
                  );
                  setSignatories((v) => v.filter((s) => s !== sig));
                }}
              >
                <Trash2 />
              </Button>
              <AddressIdentity addr={sig} />
            </li>
          ))}
          <li>
            <AddressInput
              onChange={(value) => {
                if (signatories.includes(value!)) return;
                setSignatories((s) => [...s, value!]);
              }}
            />
          </li>
        </ul>
        <div className="flex items-center gap-4">
          <div className="text-sm whitespace-nowrap tabular-nums">
            Threshold: {threshold}
          </div>
          <Slider
            value={[threshold]}
            onValueChange={([threshold]) => setThreshold(threshold)}
            disabled={signatories.length <= 2}
            min={2}
            max={Math.max(2, signatories.length)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="font-medium text-muted-foreground">
          Resulting multisig
        </h3>
        {multisigAddress ? (
          <AddressIdentity addr={multisigAddress} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted" />
        )}
        <Input
          name="account-name"
          disabled={!multisigAddress}
          value={name}
          onChange={(evt) => setName(evt.target.value)}
          placeholder="Name (optional)"
        />
      </div>
      <div>
        <h3 className="font-medium text-muted-foreground">
          Select your signer
        </h3>
        {
          <AccountPicker
            value={selectedAccount}
            onChange={setSelectedAccount}
            groups={availableSigners}
            className="max-w-auto"
            disableClear
            renderAddress={(account) => (
              <AddressIdentity
                addr={account.address}
                name={account?.name}
                copyable={false}
              />
            )}
          />
        }
      </div>
      <div className="flex justify-end">
        <Button disabled={!multisigAddress || !selectedAccount}>
          Add Multisig
        </Button>
      </div>
    </form>
  );
};

const AddressInput: FC<{
  value?: AccountAddress | null;
  onChange?: (value: AccountAddress | null) => void;
}> = ({ ...props }) => {
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
      hinted={Object.values(hints).flat()}
      triggerClassName="h-9"
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
      {...props}
    />
  );
};
