## Unreleased

## 0.8.0 2026-07-13

### Changed

- Updated to PAPI v3

### Removed

- `@polkahub/mimir`

### Fixed

- `@polkahub/wallet-connect`
  - Potentially broken `signBytes` because of unmatched `chainId`

## 0.7.2 2026-07-08

### Fixed

- `@polkahub/select-account`
  - Unresponsive select account when an account is not persisted.

## 0.7.1 2026-07-07

### Fixed

- `@polkahub/read-only`
  - Support fake signing with eth-like addresses

- `@polkahub/select-account`
  - Refresh selected account from persistence when plugins change

- `@polkahub/wallet-connect`
  - Do not show duplicated accounts

## 0.7.0 2026-05-13

### Added

- `AddressInput` optional prop `format?: "ss58" | "eth"` to filter accounts for an specific format.
- `readOnlyProvider` supports storing `{ name, address }` rather than just address.

## 0.6.0 2026-04-29

### Fixed

- Update dependencies

- `@polkahub/multisig`
  - Display account name on multisig account list.
  - Fix link visual overflow on `MultisigExternalSignerModal`.
  - Improve dark mode support.

- `@polkahub/proxy`
  - Display account name on proxy account list.
  - Improve dark mode support.

- `@polkahub/read-only`
  - Display account name on read-only account list.

- `@polkahub/vault`
  - Display account name on vault account list.

### Changed

- `@polkahub/ui-components`
  - Remove `Alert`, replace with newer `AlertBox` from shadcn/ui

- `@polkahub/multisig`
  - `MultisigExternalSignerModal.getMultisigUrl` can also return `Promise<string>`.

## 0.5.1 2026-03-17

### Fixed

- Update dependencies

## 0.5.0 2026-02-24

### Changed

- Use `polkadot-api@2` libraries

## 0.4.0 2025-11-20

### Added

- `@polkahub/vault`
  - Add support for `CheckMetadataHash`

### Fixed

- `@polkahub/vault`
  - Fix `signBytes`

## 0.3.1 2025-11-10

### Fixed

- Update dependencies

## 0.3.0 2025-11-10

### Added

- Manage proxy accounts.
- Manage multisig accounts.
- Add `name` field to read-only manager.
- `@polkahub-ui/components`
  - `Slider` component from shadcn/ui
  - `InlineAddressInput`: An address input without a popover.

### Changed

- Replace `maxAddrLength` properties for `MaxAddrLengthContext`.
- Multisig: provider now takes a `CreateMultisigSigner` parameter, to customize signer behaviour.
  - Use `multisigDirectSigner` for the default behaviour.
- Proxy: provider now requres a `GetDelegates` parameter.

## 0.2.2 2025-11-08

### Fixed

- `ledger`: Vite not using `buffer` polyfill when in dev mode.
- `PolkaHubModal`: Prevent auto-closing the dialog when the ss58 format changes.
- `ui-components`: Account select is not scrollable when using default `@radix-ui/react-dialog` in another dialog.

## 0.2.1 2025-11-07

### Fixed

- `selectAccountPlugin.selectedAccount$` is not using the configured SS58 format.

## 0.2.0 2025-11-07

### Changed

- Added global `ss58Format` option to `createPolkaHub`. The views will use this format to show account addresses.
- `useSS58Format` and `useSS58Formatter` to get this value from context.
- Changed the `Plugin` interface: Now it receives both the plugins and ss58 format through `receiveContext` property.
- `createLedgerProvider` doesn't take an ss58Format from the networkInfo parameter anymore.

## 0.1.1 2025-11-06

### Changed

Initial release
