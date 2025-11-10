import {
  AddressIdentity,
  useAvailableAccounts,
  useModalContext,
  usePlugin,
  usePolkaHubContext,
} from "@polkahub/context";
import {
  Account,
  AccountAddress,
  addrEq,
  defaultSerialize,
} from "@polkahub/plugin";
import { ProxyProvider, proxyProviderId } from "@polkahub/proxy";
import {
  AccountPicker,
  AlertBox,
  Button,
  InlineAddressInput,
  Input,
} from "@polkahub/ui-components";
import { useEffect, useMemo, useState, type FC } from "react";
import {
  EMPTY,
  filter,
  firstValueFrom,
  from,
  map,
  merge,
  switchMap,
} from "rxjs";
import { MultisigProvider, multisigProviderId } from "./provider";

type AccountWithMultisig = Account & {
  multisig: {
    proxy?: AccountAddress;
    address: AccountAddress;
    result: {
      addresses: AccountAddress[];
      threshold: number;
    };
  };
};

export type GetMultisigDetails = (
  address: AccountAddress
) => Promise<{ addresses: AccountAddress[]; threshold: number } | null>;

export const AddIndexedMultisig: FC<{
  getMultisigDetails: GetMultisigDetails;
}> = ({ getMultisigDetails }) => {
  const { popContent } = useModalContext();
  const multisigProvider = usePlugin<MultisigProvider>(multisigProviderId);
  const proxyProvider = usePlugin<ProxyProvider>(proxyProviderId);
  const { polkaHub } = usePolkaHubContext();
  const [multisigAddress, setMultisigAddress] = useState<AccountAddress | null>(
    null
  );
  const [name, setName] = useState("");
  const [selectedAccount, setSelectedAccount] =
    useState<AccountWithMultisig | null>(null);

  return (
    <form
      className="space-y-2"
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

        const details = selectedAccount.multisig.result;
        const serializeFn = parentProvider.serialize ?? defaultSerialize;

        if (selectedAccount.multisig.proxy) {
          const multisigAccount = await multisigProvider!.addMultisig({
            signatories: details.addresses,
            threshold: details.threshold,
            parentSigner: serializeFn(selectedAccount),
          });

          await proxyProvider?.addProxy({
            real: multisigAddress,
            parentSigner: (multisigProvider!.serialize ?? defaultSerialize)(
              multisigAccount
            ),
            name: name.trim() ? name.trim() : undefined,
          });
        } else {
          multisigProvider?.addMultisig({
            signatories: details.addresses,
            threshold: details.threshold,
            parentSigner: serializeFn(selectedAccount),
            name: name.trim() ? name.trim() : undefined,
          });
        }

        popContent();
      }}
    >
      <div className="space-y-2">
        <h3 className="font-medium text-muted-foreground">
          Insert Multisig Address
        </h3>
        <div className="flex gap-2">
          <InlineAddressInput
            value={multisigAddress}
            onChange={setMultisigAddress}
            className="max-w-auto shrink-[2]"
          />
          <Input
            name="account-name"
            value={name}
            onChange={(evt) => setName(evt.target.value)}
            placeholder="Name (optional)"
            className="shrink-[3]"
          />
        </div>
      </div>
      {multisigAddress ? (
        <IndexedMultisigInfo
          value={selectedAccount}
          onChange={setSelectedAccount}
          address={multisigAddress}
          getMultisigDetails={getMultisigDetails}
        />
      ) : null}
      <div className="flex justify-end">
        <Button disabled={!multisigAddress || !selectedAccount}>
          Add Multisig
        </Button>
      </div>
    </form>
  );
};

const IndexedMultisigInfo: FC<{
  value: AccountWithMultisig | null;
  onChange: (value: AccountWithMultisig | null) => void;
  address: AccountAddress;
  getMultisigDetails: GetMultisigDetails;
}> = ({ value, onChange, address, getMultisigDetails }) => {
  const proxyProvider = usePlugin<ProxyProvider>(proxyProviderId);
  const multisigDetails = useAsync(() => {
    const directMultisig$ = from(getMultisigDetails(address)).pipe(
      filter((v) => !!v),
      map((result) => ({
        proxy: undefined,
        address,
        result,
      }))
    );
    const proxyMultisig$ = proxyProvider
      ? from(proxyProvider.getDelegates(address)).pipe(
          switchMap((res) => {
            if (!res) return EMPTY;
            const addresses = [...new Set(res.map((v) => v.delegate))];
            return merge(
              ...addresses.map((addr) =>
                from(getMultisigDetails(addr)).pipe(
                  filter((v) => !!v),
                  map((result) => ({
                    proxy: address,
                    address: addr,
                    result,
                  }))
                )
              )
            );
          })
        )
      : EMPTY;

    // This covers the most common scenario of a pure proxy, but TODO might fail for other scenarios: Multiple delegators, or a multisig that's also a proxy.
    return firstValueFrom(merge(directMultisig$, proxyMultisig$), {
      defaultValue: null,
    });
  }, [address]);
  const availableAccounts = useAvailableAccounts();
  const availableSigners = useMemo(
    () =>
      Object.entries(availableAccounts)
        .map(([name, accounts]) => ({
          name,
          accounts: accounts.filter((acc) => !!acc.signer),
        }))
        .filter(({ accounts }) => accounts.length > 0),
    [availableAccounts]
  );

  if (multisigDetails.type === "loading") return null;
  if (multisigDetails.value == null)
    return (
      <AlertBox variant="error">
        Multisig information not found. Try manual input.
      </AlertBox>
    );

  const details = multisigDetails.value;
  const notice = details.proxy ? (
    <AlertBox>
      <p>
        The value you entered wasn't found as a multisig, but rather as a proxy.
      </p>
      <p>
        We will create both signers, but you will find your entered Address in
        the "proxies" group instead of the multisigs one.
      </p>
    </AlertBox>
  ) : null;

  const selectableSigners = availableSigners
    .map(({ name, accounts }) => ({
      name,
      accounts: accounts.filter((acc) =>
        details.result.addresses.some((addr) => addrEq(acc.address, addr))
      ),
    }))
    .filter(({ accounts }) => accounts.length > 0);

  return (
    <div className="space-y-2">
      {notice}
      <div>
        <h3 className="font-medium text-muted-foreground">
          Multisig signatories (threshold {details.result.threshold})
        </h3>
        <ul>
          {details.result.addresses.map((addr) => (
            <li key={addr}>
              <AddressIdentity addr={addr} />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-medium text-muted-foreground">
          Select your signer
        </h3>
        {selectableSigners.length ? (
          <AccountPicker
            value={value}
            onChange={(value) =>
              onChange(
                value
                  ? {
                      ...value,
                      multisig: details,
                    }
                  : null
              )
            }
            groups={selectableSigners}
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
        ) : (
          <AlertBox variant="error">
            <p>
              None of the signatories of this multisig matches any of your
              signers.
            </p>
            <p>Please, first configure your signer account</p>
          </AlertBox>
        )}
      </div>
    </div>
  );
};

const useAsync = <T,>(fn: () => Promise<T>, deps: unknown[]) => {
  const [value, setValue] = useState<
    | {
        type: "loading" | "error";
        value?: never;
      }
    | {
        type: "result";
        value: T;
      }
  >({
    type: "loading",
  });

  useEffect(() => {
    let cancelled = false;

    setValue({ type: "loading" });
    fn().then(
      (value) => {
        if (cancelled) return;
        setValue({ type: "result", value });
      },
      (ex) => {
        if (cancelled) return;
        console.error(ex);
        setValue({ type: "error" });
      }
    );

    return () => {
      cancelled = true;
    };
  }, deps);

  return value;
};
