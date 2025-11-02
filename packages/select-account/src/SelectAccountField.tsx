import { AddressIdentity, useAvailableAccounts } from "@polkahub/context";
import {
  Button,
  cn,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@polkahub/ui-components";
import { ChevronsUpDown, X } from "lucide-react";
import { useState, type FC } from "react";
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
  const [open, setOpen] = useState(false);

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
      <Popover open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 overflow-hidden">
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={cn(
                "flex w-full shrink justify-between overflow-hidden border border-border bg-background h-12",
                className
              )}
            >
              {account?.address != null ? (
                <AddressIdentity
                  addr={account.address}
                  name={account?.name}
                  copyable={false}
                />
              ) : (
                <span className="opacity-80">Select…</span>
              )}
              <ChevronsUpDown size={14} className="opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          {account ? (
            <button className="cursor-pointer" onClick={() => setAccount(null)}>
              <X className="text-muted-foreground" size={16} />
            </button>
          ) : null}
        </div>
        <PopoverContent
          className="p-0"
          style={{
            width:
              "calc(min(var(--spacing) * 96, var(--radix-popper-available-width)))",
          }}
        >
          <Command>
            <CommandInput placeholder="Search and select…" />
            <CommandList>
              <CommandEmpty>
                <div className="text-foreground/50">
                  The searched value doesn't match the filter
                </div>
              </CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.name} heading={group.name}>
                  {group.accounts.map((account, i) => (
                    <AccountOption
                      key={i}
                      account={account.address}
                      name={account.name}
                      group={group.name}
                      onSelect={() => {
                        setAccount(account);
                        setOpen(false);
                      }}
                    />
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const AccountOption: FC<{
  account: string;
  group: string;
  name?: string;
  onSelect: () => void;
}> = ({ account, group, name, onSelect }) => (
  <CommandItem
    keywords={[group, name].filter((v) => v != null)}
    value={account + " " + group}
    onSelect={onSelect}
    className="flex flex-row items-center gap-2 p-1"
  >
    <AddressIdentity addr={account} name={name} />
  </CommandItem>
);
