import { AccountDisplay, AccountInfo } from "@polkadot-api/react-components";
import { AccountId } from "@polkadot-api/substrate-bindings";
import { toHex } from "@polkadot-api/utils";
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
import {
  PropsWithChildren,
  ReactNode,
  useMemo,
  useState,
  type FC,
} from "react";

export function AddressInput<T extends AccountInfo = never>({
  className,
  value,
  onChange,
  renderAddress = (value) => (
    <AccountDisplay
      className="overflow-hidden"
      account={typeof value === "string" ? { address: value } : value}
      copyable={false}
    />
  ),
  hinted = [],
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  hinted?: Array<T | string>;
  renderAddress?: (value: T | string) => ReactNode;
}) {
  const [query, setQuery] = useState("");
  const queryIsValidAddr = isValidAddr(query);

  const [open, _setOpen] = useState(false);
  const setOpen = (value: boolean) => {
    _setOpen(value);
    setQuery("");
  };

  const cleanHinted = useMemo(() => {
    const mapped = hinted.map((v) =>
      typeof v === "string" ? { address: v } : v
    );
    // we'll key by address, so we need unique hints.
    const byAddress = new Map(mapped.map((v) => [v.address, v]));
    return [...byAddress.values()];
  }, [hinted]);

  const hintedValue = value
    ? cleanHinted.find((acc) => addrEq(acc.address, value))
    : null;
  const valueIsNew = hintedValue == null;

  const queryMatchesHint =
    queryIsValidAddr &&
    ((value && addrEq(query, value)) ||
      cleanHinted.some((acc) => addrEq(acc.address, query)));

  if (value !== null) {
    cleanHinted.sort((a, b) =>
      addrEq(a.address, value) ? -1 : addrEq(b.address, value) ? 1 : 0
    );
  }

  const onTriggerKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key.length === 1) {
      setOpen(true);
    }
  };

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
          <CommandInput
            placeholder="Filter or insert…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              <div className="text-foreground/50">
                The value is not a valid Account ID
              </div>
            </CommandEmpty>
            <CommandGroup>
              {valueIsNew && value ? (
                <AccountOption
                  account={hintedValue ?? { address: value }}
                  onSelect={() => setOpen(false)}
                >
                  {renderAddress(hintedValue ?? value)}
                </AccountOption>
              ) : null}
              {hinted.map((account, i) => (
                <AccountOption
                  key={i}
                  account={
                    typeof account === "string" ? { address: account } : account
                  }
                  onSelect={() => {
                    onChange(
                      typeof account === "string" ? account : account.address
                    );
                    setOpen(false);
                  }}
                >
                  {renderAddress(account)}
                </AccountOption>
              ))}
              {queryIsValidAddr && !queryMatchesHint ? (
                <AccountOption
                  account={{ address: query }}
                  onSelect={() => {
                    onChange(query);
                    setOpen(false);
                  }}
                >
                  {renderAddress(query)}
                </AccountOption>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const AccountOption: FC<
  PropsWithChildren<{
    account: AccountInfo;
    onSelect: () => void;
  }>
> = ({ account, onSelect, children }) => (
  <CommandItem
    keywords={account.name == null ? [] : [account.name]}
    value={[account.address, account.name, account.subId]
      .filter((v) => v != null)
      .join(" ")}
    onSelect={onSelect}
    className="flex flex-row items-center gap-2 p-1"
  >
    {children}
  </CommandItem>
);

const [ss58ToBin] = AccountId();
const addrEq = (a: string, b: string) => {
  if (!a.startsWith("0x")) {
    try {
      a = toHex(ss58ToBin(a));
    } catch (ex) {}
  }
  if (!b.startsWith("0x")) {
    try {
      b = toHex(ss58ToBin(b));
    } catch (ex) {}
  }
  return a === b;
};
const isValidAddr = (value: string) => {
  if (value.startsWith("0x")) return value.length === 42;
  try {
    ss58ToBin(value);
    return true;
  } catch (ex) {
    return false;
  }
};
