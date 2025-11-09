import {
  createLedgerProvider,
  createPjsWalletProvider,
  createPolkadotVaultProvider,
  createPolkaHub,
  createProxyProvider,
  createReadOnlyProvider,
  createSelectedAccountPlugin,
  createWalletConnectProvider,
  knownChains,
} from "polkahub";
import { dotApi, identitySdk } from "./client";

const selectedAccountPlugin = createSelectedAccountPlugin();
const pjsWalletProvider = createPjsWalletProvider();
const polkadotVaultProvider = createPolkadotVaultProvider();
const readOnlyProvider = createReadOnlyProvider({
  fakeSigner: true,
});
const ledgerAccountProvider = createLedgerProvider(
  async () => {
    // Ledger requires `Buffer` polyfill.
    // The plugin already handles this for us, but we can't import the
    // `hw-transport-webhid` package until buffer isn't loaded.
    // So we must import it here. And we get code-splitting for free :)
    const { default: Transport } = await import(
      "@ledgerhq/hw-transport-webhid"
    );
    return Transport.create();
  },
  async () => ({
    decimals: 10,
    tokenSymbol: "DOT",
  })
);
const walletConnectProvider = createWalletConnectProvider(
  import.meta.env.VITE_REOWN_PROJECT_ID,
  [knownChains.polkadot]
);

export const polkaHub = createPolkaHub(
  [
    createProxyProvider(),
    selectedAccountPlugin,
    pjsWalletProvider,
    polkadotVaultProvider,
    readOnlyProvider,
    ledgerAccountProvider,
    walletConnectProvider,
  ],
  {
    async getIdentity(address) {
      const id = await identitySdk.getIdentity(address);
      return id?.info.display
        ? {
            name: id.info.display,
            verified: id.verified,
            subId: id.subIdentity,
          }
        : null;
    },
    async getBalance(address) {
      const account = await dotApi.query.System.Account.getValue(address);
      return {
        value: account.data.free,
        decimals: 10,
        symbol: "DOT",
      };
    },
  }
);
