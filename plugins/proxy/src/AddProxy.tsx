import {
  AddressIdentity,
  useAvailableAccounts,
  useModalContext,
  usePlugin,
  usePolkaHubContext,
} from "@polkahub/context";
import { Account, AccountAddress, defaultSerialize } from "@polkahub/plugin";
import {
  AccountPicker,
  AlertBox,
  Button,
  InlineAddressInput,
  Input,
} from "@polkahub/ui-components";
import { AccountId } from "polkadot-api";
import { toHex } from "polkadot-api/utils";
import { useEffect, useMemo, useState, type FC } from "react";
import { ProxyProvider, proxyProviderId } from "./provider";

const proxyTypeText = {
  Any: "Any",
  AssetManager: "Asset Manager",
  AssetOwner: "Asset Owner",
  Assets: "Assets",
  Auction: "Auction",
  CancelProxy: "Cancel Proxy",
  Collator: "Collator",
  Governance: "Governance",
  NominationPools: "Nomination Pools",
  NonTransfer: "Non-Transfer",
  ParaRegistration: "Para Registration",
  Staking: "Staking",
};
type ProxyType = keyof typeof proxyTypeText;

export type ProxyEntry = {
  delegate: AccountAddress;
  proxy_type: {
    type: ProxyType;
  };
  delay: number;
};

export type GetDelegates = (
  address: AccountAddress
) => Promise<Array<ProxyEntry> | null>;

export type AddProxyProps = {
  maxAddrLength?: number;
  getDelegates?: GetDelegates;
  blockLength?: number;
};

export const AddProxy: FC<AddProxyProps> = ({
  maxAddrLength = 12,
  getDelegates,
  blockLength,
}) => {
  const { popContent } = useModalContext();
  const proxyProvider = usePlugin<ProxyProvider>(proxyProviderId);
  const { polkaHub } = usePolkaHubContext();

  const [proxyAddress, setProxyAddress] = useState<AccountAddress | null>(null);
  const [name, setName] = useState("");
  const [selectedAccount, setSelectedAccount] =
    useState<AccountWithProxy | null>(null);

  return (
    <form
      className="space-y-2"
      onSubmit={(evt) => {
        evt.preventDefault();
        if (!proxyAddress || !selectedAccount) return null;

        const plugins = polkaHub.plugins$.getValue();
        const parentProvider = plugins.find(
          (p) => p.id === selectedAccount.provider
        );
        if (!parentProvider)
          throw new Error(
            `Parent provider ${selectedAccount.provider} not found`
          );

        const serializeFn = parentProvider.serialize ?? defaultSerialize;
        proxyProvider?.addProxy({
          real: proxyAddress,
          parentSigner: serializeFn(selectedAccount),
          name: name.trim() ? name.trim() : undefined,
        });

        popContent();
      }}
    >
      <div className="space-y-2">
        <h3 className="font-medium text-muted-foreground">
          Insert Proxy Address (Delegator)
        </h3>
        <div className="flex gap-2">
          <InlineAddressInput
            value={proxyAddress}
            onChange={setProxyAddress}
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
      {proxyAddress ? (
        <div className="space-y-2">
          <h3 className="font-medium text-muted-foreground">
            Select your signer (Delegate)
          </h3>
          <ProxySignerPicker
            maxAddrLength={maxAddrLength}
            value={selectedAccount}
            onChange={setSelectedAccount}
            proxy={proxyAddress}
            getDelegates={getDelegates}
          />
        </div>
      ) : null}
      {selectedAccount?.delegate ? (
        <div>
          <h3 className="font-medium text-muted-foreground">Permissions</h3>
          <ul className="flex flex-wrap gap-2">
            {selectedAccount.delegate.map((entry, i) => (
              <li key={i} className="border rounded px-2 py-1">
                {proxyTypeText[entry.proxy_type.type]}
                {entry.delay
                  ? ` (${getDelayLength(entry.delay, blockLength)})`
                  : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button disabled={!proxyAddress || !selectedAccount}>Add Proxy</Button>
      </div>
    </form>
  );
};

const getDelayLength = (blocks: number, blockLength?: number) => {
  if (!blockLength) return `delay ${blocks}`;

  const seconds = (blocks * blockLength) / 1000;
  if (seconds < 120) {
    return `${Math.round(seconds)}s delay`;
  }
  const minutes = Math.round(seconds / 60);
  const min = minutes % 60;
  const hours = Math.floor(minutes / 60);
  const hr = hours % 24;
  const days = Math.floor(hours / 24);

  const time = `${hr}:${min.toString().padStart(2, "0")} delay`;
  if (!days) {
    return time;
  }
  return `${days}d ${time}`;
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

type AccountWithProxy = Account & {
  delegate?: ProxyEntry[];
};

const ProxySignerPicker: FC<{
  value: AccountWithProxy | null;
  onChange: (value: AccountWithProxy | null) => void;
  proxy: AccountAddress;
  maxAddrLength: number;
  getDelegates?: GetDelegates;
}> = ({
  value,
  onChange,
  maxAddrLength,
  proxy,
  getDelegates = async () => null,
}) => {
  const availableAccounts = useAvailableAccounts();
  const delegatesResult = useAsync(() => getDelegates(proxy), [proxy]);
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

  const selectableSigners = useMemo(() => {
    if (delegatesResult.type === "loading") return null;
    if (delegatesResult.value == null) return availableSigners;

    const delegates = delegatesResult.value.reduce(
      (acc: Record<string, ProxyEntry[]>, delegate) => {
        const commonAddr = addrToCommon(delegate.delegate);
        acc[commonAddr] ??= [];
        acc[commonAddr].push(delegate);
        return acc;
      },
      {}
    );

    return availableSigners
      .map(({ name, accounts }) => ({
        name,
        accounts: accounts
          .map((account): AccountWithProxy | null => {
            const delegate = delegates[addrToCommon(account.address)];
            if (!delegate) return null;
            return {
              ...account,
              delegate,
            };
          })
          .filter((v) => v != null),
      }))
      .filter(({ accounts }) => accounts.length > 0);
  }, [delegatesResult, availableSigners]);

  if (availableSigners.length === 0) {
    return (
      <AlertBox variant="error">
        First you need to connect the real signer account
      </AlertBox>
    );
  }
  if (selectableSigners == null) return <div>Loading…</div>;

  if (
    selectableSigners.length === 0 &&
    delegatesResult.type === "result" &&
    delegatesResult.value
  ) {
    const reason =
      delegatesResult.value.length === 0
        ? `Account doesn't seem to be a proxy.`
        : `None of your connected signers is identified as a delegate of this proxy.`;

    return (
      <>
        <AlertBox>
          <p>{reason}</p>
          <p>
            You can still select one of your signers, but it's very likely the
            transactions will fail.
          </p>
        </AlertBox>
        <AccountPicker
          value={value}
          onChange={onChange}
          groups={availableSigners}
          className="max-w-auto"
          disableClear
          renderAddress={(account) => (
            <AddressIdentity
              addr={account.address}
              name={account?.name}
              maxAddrLength={maxAddrLength}
              copyable={false}
            />
          )}
        />
      </>
    );
  }

  return (
    <AccountPicker
      value={value}
      onChange={onChange}
      groups={selectableSigners}
      className="max-w-auto"
      disableClear
      renderAddress={(account) => (
        <AddressIdentity
          addr={account.address}
          name={account?.name}
          maxAddrLength={maxAddrLength}
          copyable={false}
        />
      )}
    />
  );
};

const [ss58ToBin] = AccountId();
const addrToCommon = (addr: AccountAddress) =>
  addr.startsWith("0x") ? "0x" : toHex(ss58ToBin(addr));
