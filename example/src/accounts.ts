import {
  createLedgerProvider,
  createPjsWalletProvider,
  createPolkadotVaultProvider,
  createReadOnlyProvider,
  createSelectedAccountPlugin,
  createWalletConnectProvider,
  knownChains,
} from "polkahub";

const selectedAccountPlugin = createSelectedAccountPlugin();
const pjsWalletProvider = createPjsWalletProvider();
const polkadotVaultProvider = createPolkadotVaultProvider();
const readOnlyProvider = createReadOnlyProvider();
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
    ss58Format: 0,
  })
);
const walletConnectProvider = createWalletConnectProvider(
  import.meta.env.VITE_REOWN_PROJECT_ID,
  [knownChains.polkadot]
);

export const polkahubPlugins = [
  selectedAccountPlugin,
  pjsWalletProvider,
  polkadotVaultProvider,
  readOnlyProvider,
  ledgerAccountProvider,
  walletConnectProvider,
];
