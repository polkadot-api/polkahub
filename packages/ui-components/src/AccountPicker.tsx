import { AccountDisplay, AccountInfo } from "@polkadot-api/react-components";
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
import { Check, ChevronsUpDown, X } from "lucide-react";
import { PropsWithChildren, ReactNode, useState, type FC } from "react";

export function AccountPicker<T extends AccountInfo = never>({
  className,
  value,
  onChange,
  groups,
  renderAddress = (value) => (
    <AccountDisplay
      className="overflow-hidden"
      account={typeof value === "string" ? { address: value } : value}
      copyable={false}
    />
  ),
}: {
  value: T | null;
  onChange: (value: T | null) => void;
  groups: { accounts: T[] } | Array<{ name: ReactNode; accounts: T[] }>;
  className?: string;
  renderAddress?: (value: T) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const onTriggerKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key.length === 1) {
      setOpen(true);
    }
  };

  const cleanGroups = Array.isArray(groups)
    ? groups
    : [
        {
          name: undefined,
          accounts: groups.accounts,
        },
      ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "flex items-center gap-2 overflow-hidden w-full max-w-96",
          className
        )}
      >
        <PopoverTrigger asChild onKeyDown={onTriggerKeyDown}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex grow shrink-0 h-12 justify-between overflow-hidden border border-border bg-background"
          >
            {value != null ? (
              renderAddress(value)
            ) : (
              <span className="opacity-80">Select…</span>
            )}
            <ChevronsUpDown size={14} className="opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        {value ? (
          <button className="cursor-pointer" onClick={() => onChange(null)}>
            <X className="text-muted-foreground" size={16} />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-96 p-0">
        <Command>
          <CommandInput placeholder="Search and select…" />
          <CommandList>
            <CommandEmpty>
              <div className="text-foreground/50">
                The searched value doesn't match any account
              </div>
            </CommandEmpty>
            {cleanGroups.map((group, i) => (
              <CommandGroup key={i} heading={group.name}>
                {group.accounts.map((account, i) => (
                  <AccountOption
                    key={i}
                    group={group.name}
                    account={account}
                    selected={value === account}
                    onSelect={() => {
                      onChange(account);
                      setOpen(false);
                    }}
                  >
                    {renderAddress(account)}
                  </AccountOption>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const AccountOption: FC<
  PropsWithChildren<{
    group?: ReactNode;
    account: AccountInfo;
    selected: boolean;
    onSelect: () => void;
  }>
> = ({ account, group, selected, onSelect, children }) => (
  <CommandItem
    keywords={[typeof group === "string" ? group : null, account.name].filter(
      (v) => v != null
    )}
    value={account.address}
    onSelect={onSelect}
    className="flex flex-row items-center gap-2 p-1"
  >
    {children}{" "}
    <Check
      size={12}
      className={cn("ml-auto shrink-0", selected ? "opacity-100" : "opacity-0")}
    />
  </CommandItem>
);
