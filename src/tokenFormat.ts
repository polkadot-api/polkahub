export interface TokenProperties {
  decimals: number;
  symbol: string;
}

export const localeProps = {
  fractionalSeparator: (0.1).toLocaleString().substring(1, 2),
  thousandsSeparator: (1000).toLocaleString().substring(1, 2),
};

export function formatValue(
  value: bigint,
  decimals: number,
  withThousands = true
) {
  if (!decimals) return value.toLocaleString();

  const mod = 10n ** BigInt(decimals);
  const integerPart = value / mod;
  const fractionalPart = value % mod;

  return (
    (withThousands ? integerPart.toLocaleString() : integerPart.toString()) +
    (fractionalPart
      ? localeProps.fractionalSeparator +
        fractionalPart
          .toString()
          .padStart(decimals, "0")
          .replaceAll("0", " ")
          .trimEnd()
          .replaceAll(" ", "0")
      : "")
  );
}
export function formatToken(value: bigint, formatOptions: TokenProperties) {
  const suffix = formatOptions.symbol ? ` ${formatOptions.symbol}` : "";
  return formatValue(value, formatOptions.decimals) + suffix;
}

export function getChainTokenProperties(chainSpec: string): TokenProperties {
  const parsed = JSON.parse(chainSpec);
  const properties = parsed.properties;
  return {
    decimals: properties?.tokenDecimals ?? 0,
    symbol: properties?.tokenSymbol ?? null,
  };
}
