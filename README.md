# PolkaHub

PolkaHub is a toolkit to integrate with multiple Polkadot Wallets, from browser extensions to air-gapped Polkadot Vault or Ledger devices, all in a modular architecture for your own setup.

![PolkaHub](./polkahub.png)

## Features

- ⚡ First-class support for popular Polkadot wallets under one API:
  - Polkadot browser extensions
  - Polkadot Vault
  - Ledger devices
  - Read-only accounts
  - WalletConnect (UI in development)
  - Proxy accounts (UI in development)
  - Multisig accounts (UI in development)
- 🧩 Plugin-based architecture so you can compose providers, account selectors, and custom wallets.
- ⚙️ Independent reactive state layer for developing your own UI.
- 🚀 Drop-in components to onboard users fast: account selection, vault import, read-only sources, and more.
- 🎣 Context-powered React hooks plus raw observables when you want total control.

## Installation

Install from npm

```sh
pnpm i polkahub
```

## Quick Start (React UI)

PolkaHub ships with ready-made React components styled with tailwind and shadcn/ui. Make sure your app already has those configured before proceeding.

### 1. Import styles

Add the shared styles to your main stylesheet (for example `src/index.css`):

```css
@import "tailwindcss";
@import "polkahub";
```

### 2. Configure providers

Create the providers you want to expose. Each provider is optional — pick only what your app needs.

```ts
// file: account-providers.ts
import {
  createPjsWalletProvider,
  createPolkadotVaultProvider,
  createReadOnlyProvider,
  createSelectedAccountPlugin,
  createPolkaHub,
} from "polkahub";

const selectedAccountPlugin = createSelectedAccountPlugin();
const pjsWalletProvider = createPjsWalletProvider();
const polkadotVaultProvider = createPolkadotVaultProvider();
const readOnlyProvider = createReadOnlyProvider();

export const polkaHub = createPolkaHub(
  [
    selectedAccountPlugin,
    pjsWalletProvider,
    polkadotVaultProvider,
    readOnlyProvider,
  ],
  // Optional
  {
    getBalance: async (address) => {
      // Some plugins show the balance of an account for reference.
      // Use your polkadot client, or ignore / return null to disable.
      return null;
    },
    getIdentity: async (address) => {
      // Some plugins show the identity of an account for reference.
      // Use your polkadot client, or ignore / return null to disable.
      return null;
    },
  }
);
```

### 3. Wrap your app

Provide the polkaHub instance through the `PolkaHubProvider`.

```tsx
import { createRoot } from "react-dom/client";
import { PolkaHubProvider } from "polkahub";
import { StrictMode } from "react";
import App from "./App.tsx";
import { polkaHub } from "./account-providers";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PolkaHubProvider polkaHub={polkaHub}>
      <App />
    </PolkaHubProvider>
  </StrictMode>
);
```

### 4. Create the modal

Create a button that triggers the modal, with the components you have selected.

```tsx
import {
  PolkaHubModal,
  SelectAccountField,
  ManagePjsWallets,
  ManageVault,
  ManageReadOnly,
} from "polkahub";

export const ConnectButton = () => (
  <PolkaHubModal>
    <SelectAccountField />
    <ManagePjsWallets />
    <div>
      <h3>Manage Connections</h3>
      <div className="flex gap-2 flex-wrap items-center justify-center">
        <ManageVault />
        <ManageReadOnly />
      </div>
    </div>
  </PolkaHubModal>
);
```

### 5. Consume accounts

Use the provided hooks anywhere under the provider to access the available accounts.

```tsx
import { useSelectedAccount, useAvailableAccounts } from "polkahub";

const MyComponent = () => {
  const availableAccounts = useAvailableAccounts(); // Record<groupName, Account[]>
  const [account, setAccount] = useSelectedAccount();

  return <div>…</div>;
};
```

## Build your own React UI

PolkaHub's modular architecture makes it possible to build your own UI reusing the same plugin setup. Reach into the state with hooks like `usePlugin`.

```tsx
import { usePlugin } from "polkahub";

const MyCustomPjsWalletManager = () => {
  const plugin = usePlugin<PolkadotVaultProvider>(polkadotVaultProviderId)!;

  return <div>…</div>;
};
```

The hook returns the plugin instance, giving you direct access to its observables and methods. Combine it with your own UI controls to tailor the experience.

## State-only usage (Advanced)

Every plugin implements a minimal contract and can expose additional methods or metadata tailored to its own use case:

```ts
interface Account {
  provider: string;
  address: SS58String;
  signer?: PolkadotSigner;
  name?: string;
}

interface SerializableAccount<T = unknown> {
  provider: string;
  address: SS58String;
  name?: string;
  extra?: T;
}

interface Plugin<A extends Account = Account> {
  id: string;
  serialize?: (account: A) => SerializableAccount;
  deserialize: (value: SerializableAccount) => Promise<A | null> | A | null;
  eq?: (a: A, b: A) => boolean;
  accounts$: Observable<A[]>;
  accountGroups$?: Observable<Record<string, A[]>>;
  receivePlugins?: (plugins: Plugin[]) => void;
  subscription$?: Observable<unknown>;
}
```

Each bundled plugin exposes observables to allow for reactive workflows. Docs for individual plugins are in progress; peek at the source to explore their state shape in the meantime.
