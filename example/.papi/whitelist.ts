import type { DotPplWhitelistEntry } from "@polkadot-api/descriptors";

export const whitelist: (DotPplWhitelistEntry | DotPplWhitelistEntry)[] = [
  "query.Identity.IdentityOf",
  "query.Identity.SuperOf",
  "query.System.Account",
  "query.Proxy.Proxies",
  "query.Multisig.Multisigs",
  "api.TransactionPaymentApi.query_info",
];
