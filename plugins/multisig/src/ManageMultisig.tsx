import {
  AddressIdentity,
  ModalContext,
  useModalContext,
  usePlugin,
  usePolkaHubContext,
} from "@polkahub/context";
import { Button, SourceButton } from "@polkahub/ui-components";
import { Users } from "lucide-react";
import { useContext, type FC } from "react";
// import { AddMultisig, AddMultisigProps, GetDelegates } from "./AddMultisig";
import { useAvailableAccounts } from "@polkahub/context";
import {
  Account,
  AccountAddress,
  addrEq,
  defaultSerialize,
  Plugin,
} from "@polkahub/plugin";
import { ProxyProvider, proxyProviderId } from "@polkahub/proxy";
import {
  AccountPicker,
  AlertBox,
  InlineAddressInput,
  Input,
} from "@polkahub/ui-components";
import { useEffect, useMemo, useState } from "react";
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

export const ManageMultisig: FC<{
  getMultisigDetails: (
    address: AccountAddress
  ) => Promise<{ addresses: AccountAddress[]; threshold: number } | null>;
}> = ({ getMultisigDetails }) => {
  const { pushContent } = useContext(ModalContext)!;
  const multisigProvider = usePlugin<MultisigProvider>(multisigProviderId);

  return (
    <SourceButton
      label="Multisig"
      onClick={() =>
        pushContent({
          title: "Multisig accounts",
          element: (
            <AddIndexedMultisig getMultisigDetails={getMultisigDetails} />
          ),
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

const AddIndexedMultisig: FC<{
  getMultisigDetails: (
    address: AccountAddress
  ) => Promise<{ addresses: AccountAddress[]; threshold: number } | null>;
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
        let parentProvider = plugins.find(
          (p) => p.id === selectedAccount.provider
        );
        if (!parentProvider)
          throw new Error(
            `Parent provider ${selectedAccount.provider} not found`
          );

        let multisigName = name;
        if (selectedAccount.multisig.proxy) {
          const serializeFn = parentProvider.serialize ?? defaultSerialize;
          await proxyProvider?.addProxy({
            real: multisigAddress,
            parentSigner: serializeFn(selectedAccount),
            name: multisigName.trim() ? multisigName.trim() : undefined,
          });
          parentProvider = proxyProvider! as Plugin<any>;
          multisigName = "";
        }

        const details = selectedAccount.multisig.result;
        const serializeFn = parentProvider.serialize ?? defaultSerialize;
        multisigProvider?.addMultisig({
          signatories: details.addresses,
          threshold: details.threshold,
          parentSigner: serializeFn(selectedAccount),
          name: multisigName.trim() ? multisigName.trim() : undefined,
        });

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
  getMultisigDetails: (
    address: AccountAddress
  ) => Promise<{ addresses: AccountAddress[]; threshold: number } | null>;
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

// const ManageAddresses: FC<AddMultisigProps> = ({ maxAddrLength, ...props }) => {
//   const { pushContent } = useModalContext();
//   const multisigProvider = usePlugin<MultisigProvider>(multisigProviderId)!;
//   const multisigAccounts = useStateObservable(multisigProvider.accounts$);
//   const setAccount = useSetSelectedAccount();

//   return (
//     <div className="space-y-4">
//       {multisigAccounts.length ? (
//         <div>
//           <h3 className="font-medium text-muted-foreground">Added addresses</h3>
//           <ul className="space-y-2">
//             {multisigAccounts.map((account, i) => (
//               <li key={i} className="flex gap-2 items-center">
//                 <Button
//                   variant="outline"
//                   className="text-destructive"
//                   type="button"
//                   onClick={() => multisigProvider.removeMultisig(account.info)}
//                 >
//                   <Trash2 />
//                 </Button>
//                 <AddressIdentity
//                   addr={account.address}
//                   maxAddrLength={maxAddrLength}
//                 />
//                 <div className="grow" />
//                 <AddressBalance addr={account.address} />
//                 {setAccount ? (
//                   <Button
//                     variant="secondary"
//                     onClick={() => {
//                       setAccount(account);
//                     }}
//                   >
//                     Select
//                   </Button>
//                 ) : null}
//               </li>
//             ))}
//           </ul>
//         </div>
//       ) : null}
//       <div className="flex justify-end">
//         <Button
//           type="button"
//           onClick={() =>
//             pushContent({
//               title: "Add Multisig",
//               element: <AddMultisig maxAddrLength={maxAddrLength} {...props} />,
//             })
//           }
//         >
//           Add Multisig
//         </Button>
//       </div>
//     </div>
//   );
// };
