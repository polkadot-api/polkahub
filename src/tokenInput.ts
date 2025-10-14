import { useEffect, useRef } from "react";
import { TokenProperties, formatValue, localeProps } from "./tokenFormat";

export const useTokenInput = (
  token: TokenProperties | null,
  value?: bigint | null,
  onChange?: (value: bigint | null) => void
) => {
  const ref = useRef<HTMLInputElement>(null as unknown as HTMLInputElement);

  const decimals = token?.decimals;
  useEffect(() => {
    if (value === undefined || decimals === undefined) return;

    const currentValue = parseValue(ref.current.value, decimals).value;
    if (value === currentValue) return;

    ref.current.value =
      value == null ? "" : formatValue(value, decimals, false);
  }, [value, decimals]);

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    if (!token) {
      evt.preventDefault();
      return;
    }

    const { value, cleaned, cursor } = parseValue(
      evt.target.value,
      token.decimals,
      evt.target.selectionStart ?? 0
    );
    evt.target.value = cleaned;
    evt.target.setSelectionRange(cursor, cursor);
    onChange?.(value);
  };

  const handleKeyDown = (evt: React.KeyboardEvent<HTMLInputElement>) => {
    if (!token) {
      evt.preventDefault();
      return;
    }

    if (evt.key.length > 1 || evt.ctrlKey || evt.metaKey) return;

    const singletonKeys = ["-", "+"];
    if (
      singletonKeys.some((v) => v === evt.key) &&
      evt.currentTarget.value.includes(evt.key)
    ) {
      evt.preventDefault();
    }
    if (
      evt.key === localeProps.fractionalSeparator ||
      evt.key === localeProps.thousandsSeparator
    ) {
      if (
        evt.currentTarget.value.includes(localeProps.fractionalSeparator) ||
        evt.currentTarget.value.includes(localeProps.thousandsSeparator)
      ) {
        evt.preventDefault();
      }
      return;
    }

    const cursor = evt.currentTarget.selectionStart ?? 0;
    if (cursor > 0 && (evt.key === "-" || evt.key === "+")) {
      evt.preventDefault();
      return;
    }

    if (!/[\d+-]/.test(evt.key)) {
      evt.preventDefault();
    }
  };

  return { ref, onChange: handleChange, onKeyDown: handleKeyDown };
};

function parseValue(
  strValue: string,
  decimals: number,
  cursor: number = 0
): { value: bigint | null; cleaned: string; cursor: number } {
  strValue = strValue.replaceAll(
    localeProps.thousandsSeparator,
    localeProps.fractionalSeparator
  );

  const parts = strValue.split(localeProps.fractionalSeparator);
  if (parts.length > 2 || strValue === "") {
    return {
      value: null,
      cleaned: strValue,
      cursor,
    };
  }

  parts[1] = parts[1]?.slice(0, decimals);

  // eslint-disable-next-line prefer-const
  let [integer, fractional] = parts;

  if (
    !/^[+|-]?\d*$/.test(integer) ||
    (fractional && !/^\d*$/.test(fractional))
  ) {
    return {
      value: null,
      cleaned: strValue,
      cursor,
    };
  }
  const cleaned =
    integer +
    (fractional == null ? "" : localeProps.fractionalSeparator + fractional);

  const firstChar = integer[0];
  const sign = firstChar === "-" ? -1n : 1n;
  if (firstChar === "+" || firstChar === "-") {
    integer = integer.slice(1);
  }

  const mod = 10n ** BigInt(decimals);
  const integerPart = BigInt(integer) * mod;
  const fractionalPart = BigInt((fractional ?? "").padEnd(decimals, "0"));

  return {
    value: sign * (integerPart + fractionalPart),
    cleaned,
    cursor,
  };
}
