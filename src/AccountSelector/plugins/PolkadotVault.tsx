/* eslint-disable @typescript-eslint/no-unused-vars */
import { createV4Tx } from "@polkadot-api/signers-common";
import {
  compact,
  decAnyMetadata,
  unifyMetadata,
} from "@polkadot-api/substrate-bindings";
import { DefaultedStateObservable, state, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import {
  Binary,
  getSs58AddressInfo,
  HexString,
  PolkadotSigner,
  SS58String,
} from "polkadot-api";
import { mergeUint8 } from "polkadot-api/utils";
import { firstValueFrom, map, merge, race } from "rxjs";
import {
  localStorageProvider,
  persistedState,
  PersistenceProvider,
} from "./persist";
import { Account, Plugin } from "./plugin";

export interface AccountInfo {
  address: SS58String;
  genesis: HexString;
}
export interface PolkadotVaultAccount extends Account {
  provider: "polkadot-vault";
  genesis: HexString;
}

export interface PolkadotVaultPlugin extends Plugin<PolkadotVaultAccount> {
  id: "polkadot-vault";
  accounts$: DefaultedStateObservable<PolkadotVaultAccount[]>;

  setAccounts: (payload: AccountInfo[]) => void;
  addAccount: (payload: AccountInfo) => PolkadotVaultAccount;
  removeAccount: (payload: AccountInfo) => void;

  activeTx$: DefaultedStateObservable<Uint8Array<ArrayBufferLike> | null>;
  setTx: (payload: Uint8Array<ArrayBufferLike>) => void;
  setSignature: (payload: Uint8Array<ArrayBufferLike>) => void;
  cancelTx: () => void;
}

export const polkadotVaultPlugin = (
  opts?: Partial<{
    persist: PersistenceProvider;
  }>
): PolkadotVaultPlugin => {
  const { persist } = {
    persist: localStorageProvider("polkadot-vault"),
    ...opts,
  };

  const [vaultAccounts$, setVaultAccounts] = persistedState(
    persist,
    [] as AccountInfo[]
  );

  const [newTx$, setTx] = createSignal<Uint8Array>();
  const [scannedSignature$, setSignature] = createSignal<Uint8Array>();
  const [cancelledTx$, cancelTx] = createSignal();

  const activeTx$ = state(
    merge(newTx$, merge(scannedSignature$, cancelledTx$).pipe(map(() => null))),
    null
  );
  const currentScannedSignature$ = race(
    scannedSignature$,
    merge(newTx$, cancelledTx$).pipe(map(() => null))
  );

  const createVaultSigner = ({
    address,
    genesis,
  }: AccountInfo): PolkadotSigner => {
    const info = getSs58AddressInfo(address);
    if (!info.isValid) {
      throw new Error("Invalid SS58 address " + address);
    }

    const publicKey = info.publicKey;

    return {
      publicKey,
      async signBytes(data) {
        // TODO
        return data;
      },
      async signTx(
        callData,
        signedExtensions,
        metadata,
        _atBlockNumber,
        _hasher
      ) {
        const decMeta = unifyMetadata(decAnyMetadata(metadata));
        const extra: Array<Uint8Array> = [];
        const additionalSigned: Array<Uint8Array> = [];
        decMeta.extrinsic.signedExtensions.map(({ identifier }) => {
          const signedExtension = signedExtensions[identifier];
          if (!signedExtension)
            throw new Error(`Missing ${identifier} signed extension`);
          extra.push(signedExtension.value);
          additionalSigned.push(signedExtension.additionalSigned);
        });
        const extensions = mergeUint8([...extra, ...additionalSigned]);

        const qrPayload = createQrTransaction(
          VaultQrEncryption.Sr25519,
          publicKey,
          callData,
          extensions,
          Binary.fromHex(genesis).asBytes()
        );
        setTx(qrPayload);

        const signature = await firstValueFrom(currentScannedSignature$);
        if (!signature) {
          throw new Error("Cancelled");
        }

        const tx = createV4Tx(
          decMeta,
          publicKey,
          // Remove encryption code, we already know it
          signature.slice(1),
          extra,
          callData,
          // TODO schema?
          "Sr25519"
        );

        return tx;
      },
    };
  };

  const accountInfoToAccount = (info: AccountInfo): PolkadotVaultAccount => ({
    provider: "polkadot-vault",
    address: info.address,
    genesis: info.genesis,
    signer: createVaultSigner(info),
  });

  const accounts$ = vaultAccounts$.pipeState(
    map((accounts) => accounts.map(accountInfoToAccount)),
    withDefault([])
  );

  return {
    id: "polkadot-vault",
    serialize: ({ address, genesis, provider }) => ({
      address,
      provider,
      extra: genesis,
    }),
    deserialize: (account) =>
      firstValueFrom(
        vaultAccounts$.pipe(
          map(
            (accounts) =>
              accounts.find(
                (acc) =>
                  acc.address === account.address &&
                  acc.genesis === account.extra
              ) ?? null
          ),
          map((info): PolkadotVaultAccount | null =>
            info ? accountInfoToAccount(info) : null
          )
        )
      ),
    accounts$,
    activeTx$,
    cancelTx,
    setSignature,
    setTx,
    setAccounts: setVaultAccounts,
    addAccount: (account) => {
      const accountKey = `${account.address}:${account.genesis}`;
      setVaultAccounts((oldAccounts) => {
        if (
          oldAccounts.some(
            (acc) => `${acc.address}:${acc.genesis}` === accountKey
          )
        )
          return oldAccounts;
        return [...oldAccounts, account];
      });
      return accountInfoToAccount(account);
    },
    removeAccount: (addr) =>
      setVaultAccounts((v) => v.filter((acc) => acc !== addr)),
  };
};

// https://github.com/novasamatech/parity-signer/blob/738e34f0b60f86b718267cfe1ca766bd291640ed/docs/src/development/UOS.md
const VAULT_QR_HEADER = new Uint8Array([0x53]);
enum VaultQrEncryption {
  Ed25519 = 0x00,
  Sr25519 = 0x01,
  Ecdsa = 0x02,
  Unsigned = 0xff,
}
enum VaultQrPayloadType {
  LegacyTx = 0x00,
  Tx = 0x02,
  Message = 0x03,
  BulkTx = 0x04,
  LoadMetadataUpdate = 0x80,
  LoadTypesUpdate = 0x81,
  AddSpecsUpdate = 0xc1,
  DerivationsImport = 0xce,
}

const createQrTransaction = (
  encrpytion: VaultQrEncryption,
  publicKey: Uint8Array,
  callData: Uint8Array,
  extensions: Uint8Array,
  genesisHash: Uint8Array
) =>
  mergeUint8([
    VAULT_QR_HEADER,
    new Uint8Array([encrpytion]),
    new Uint8Array([VaultQrPayloadType.Tx]),
    publicKey,
    compact.enc(callData.length),
    callData,
    extensions,
    genesisHash,
  ]);
