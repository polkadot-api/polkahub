import { AccountAddress } from "@polkahub/plugin";
import { Balance } from "@polkahub/state";
import { FC } from "react";
import { useBalance } from "./polkahubContext";

export const formatBalance = (balance: Balance) => {
  const decimalValue = Number(balance.value) / 10 ** balance.decimals;
  const res = [decimalValue.toLocaleString()];
  if (balance.symbol) res.push(balance.symbol);
  return res.join(" ");
};

export const AddressBalance: FC<{
  addr: AccountAddress;
  className?: string;
}> = ({ addr, className }) => {
  const balance = useBalance(addr);
  return balance ? (
    <span className={className}>{formatBalance(balance)}</span>
  ) : null;
};
