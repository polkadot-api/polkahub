import { AccountDisplay, AccountInfo } from "@polkadot-api/react-components";
import { defaultFilter } from "cmdk";
import { Check } from "lucide-react";
import { PropsWithChildren, ReactNode, type FC } from "react";
import { addrEq } from "./AddressInput";
import { AddressInputPopover } from "./AddressInputPopover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./Command";
import { cn } from "./utils";

export function AccountPicker<T extends AccountInfo = never>({
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
  disableClear,
  ...props
}: {
  value?: T | null;
  onChange?: (value: T | null) => void;
  groups: { accounts: T[] } | Array<{ name: ReactNode; accounts: T[] }>;
  className?: string;
  triggerClassName?: string;
  disableClear?: boolean;
  renderAddress?: (value: T) => ReactNode;
}) {
  const cleanGroups = Array.isArray(groups)
    ? groups
    : [
        {
          name: undefined,
          accounts: groups.accounts,
        },
      ];

  return (
    <AddressInputPopover
      renderValue={() =>
        value != null ? (
          renderAddress(value)
        ) : (
          <span className="opacity-80">Select…</span>
        )
      }
      hasValue={!!value}
      onClear={disableClear ? undefined : () => onChange?.(null)}
      {...props}
    >
      {(close) => (
        <Command
          filter={(value, search, keywords) => {
            const [addr] = keywords ?? [];
            if (addr && addrEq(search, addr)) return search === addr ? 1 : 0.9;

            return defaultFilter(value, search, keywords);
          }}
        >
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
                    selectedValue={value}
                    onSelect={() => {
                      onChange?.(account);
                      close();
                    }}
                  >
                    {renderAddress(account)}
                  </AccountOption>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      )}
    </AddressInputPopover>
  );
}

const AccountOption: FC<
  PropsWithChildren<{
    group?: ReactNode;
    account: AccountInfo;
    selected: boolean;
    selectedValue?: AccountInfo | null;
    onSelect: () => void;
  }>
> = ({ account, group, selected, onSelect, children }) => (
  <CommandItem
    keywords={[
      account.address,
      typeof group === "string" ? group : null,
      account.name,
    ].filter((v) => v != null)}
    value={[group, account.address].filter((v) => v != null).join(" ")}
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
