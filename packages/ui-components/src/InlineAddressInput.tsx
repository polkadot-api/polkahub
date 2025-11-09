import {
  EthIdenticon,
  PolkadotIdenticon,
} from "@polkadot-api/react-components";
import { AccountId } from "@polkadot-api/substrate-bindings";
import { cn, inputClassNames } from "@polkahub/ui-components";
import {
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
  useEffect,
  useRef,
  useState,
} from "react";

export function InlineAddressInput({
  value,
  onChange,
  renderAddress = (value) => value,
  className,
  name = "address",
}: {
  value?: string | null;
  onChange?: (value: string | null) => void;
  renderAddress?: (value: string) => ReactNode;
  className?: string;
  name?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(value ?? "");
  const queryIsValidAddr = isValidAddr(query);

  useEffect(() => {
    if (!ref.current || ref.current !== document.activeElement) {
      setQuery(value ?? "");
    }
  }, [value]);

  const onValueChange = (newValue: string) => {
    setQuery(newValue);
    if (isValidAddr(newValue)) {
      onChange?.(newValue);
    } else if (value != null) {
      onChange?.(null);
    }
  };

  const focusInput = (evt: MouseEvent | TouchEvent) => {
    evt.preventDefault();
    ref.current?.focus();
  };
  const stopPropagation = (evt: MouseEvent | TouchEvent) => {
    evt.stopPropagation();
  };

  return (
    <div
      className={cn(
        inputClassNames,
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        "inline-flex px-1 cursor-text overflow-hidden",
        className
      )}
      onMouseDown={focusInput}
      onTouchStart={focusInput}
    >
      {queryIsValidAddr ? (
        query.startsWith("0x") ? (
          <EthIdenticon
            address={query}
            className="max-h-8 h-full w-auto aspect-square rounded"
          />
        ) : (
          <PolkadotIdenticon
            publicKey={ss58ToBin(query)}
            className="max-h-8 h-full w-auto aspect-square"
          />
        )
      ) : (
        <div className="bg-muted rounded-full max-h-full h-8 aspect-square" />
      )}
      <div className="grid grid-cols-1 grid-rows-1 w-full items-center font-mono">
        <input
          ref={ref}
          value={query}
          name={name}
          className={cn(
            "outline-none col-start-1 row-start-1 peer opacity-0 focus-visible:opacity-100 w-full p-1",
            { "opacity-100": !value }
          )}
          onChange={(evt) => onValueChange(evt.target.value)}
          placeholder="Address"
          onMouseDown={stopPropagation}
          onTouchStart={stopPropagation}
        />
        <div className="col-start-1 row-start-1 pointer-events-none peer-focus-visible:invisible overflow-hidden text-ellipsis p-1">
          {value ? renderAddress(value) : null}
        </div>
      </div>
    </div>
  );
}

const [ss58ToBin] = AccountId();
const isValidAddr = (value: string) => {
  if (value.startsWith("0x")) return value.length === 42;
  try {
    ss58ToBin(value);
    return true;
  } catch (ex) {
    return false;
  }
};
