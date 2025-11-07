import { AccountId, HexString, SS58String } from "polkadot-api";
import { toHex } from "polkadot-api/utils";

export type AccountAddress = SS58String | HexString;

const [ss58ToBin] = AccountId();
export const addrEq = (a: string | undefined, b: string | undefined) => {
  if (a == null || b == null) return a === b;
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

export const ss58Reformat = (address: SS58String, format: number) => {
  const codec = AccountId(format);
  return codec.dec(codec.enc(address));
};
