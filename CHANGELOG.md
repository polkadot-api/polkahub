## Unreleased

## 0.2.0 2025-11-07

### Changed

- Added global `ss58Format` option to `createPolkaHub`. The views will use this format to show account addresses.
- `useSS58Format` and `useSS58Formatter` to get this value from context.
- Changed the `Plugin` interface: Now it receives both the plugins and ss58 format through `receiveContext` property.
- `createLedgerProvider` doesn't take an ss58Format from the networkInfo parameter anymore.

## 0.1.1 2025-11-06

### Changed

Initial release
