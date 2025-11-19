import { createV4Tx } from "@polkadot-api/signers-common";
import {
  compact,
  decAnyMetadata,
  unifyMetadata,
} from "@polkadot-api/substrate-bindings";
import {
  Account,
  AccountAddress,
  addrEq,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin";
import { DefaultedStateObservable, state, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import {
  Binary,
  getSs58AddressInfo,
  HexString,
  PolkadotSigner,
} from "polkadot-api";
import { mergeUint8 } from "polkadot-api/utils";
import { firstValueFrom, map, merge, race } from "rxjs";
import {
  merkleizeMetadata,
  MetadataMerkleizer,
} from "@polkadot-api/merkleize-metadata";

export const polkadotVaultProviderId = "polkadot-vault";
export interface VaultAccountInfo {
  address: AccountAddress;
  genesis: HexString;
}
export interface PolkadotVaultAccount extends Account {
  provider: "polkadot-vault";
  genesis: HexString;
}

export interface PolkadotVaultProvider extends Plugin<PolkadotVaultAccount> {
  id: "polkadot-vault";
  accounts$: DefaultedStateObservable<PolkadotVaultAccount[]>;

  setAccounts: (payload: VaultAccountInfo[]) => void;
  addAccount: (payload: VaultAccountInfo) => PolkadotVaultAccount;
  removeAccount: (payload: VaultAccountInfo) => void;

  activeTx$: DefaultedStateObservable<Uint8Array<ArrayBufferLike> | null>;
  setTx: (payload: Uint8Array<ArrayBufferLike>) => void;
  setSignature: (payload: Uint8Array<ArrayBufferLike>) => void;
  cancelTx: () => void;
}

export type NetworkInfo = {
  decimals: number;
  tokenSymbol: string;
};

export const createPolkadotVaultProvider = (
  opts?: Partial<{
    persist: PersistenceProvider;
    getNetworkInfo: () => Promise<NetworkInfo>;
  }>
): PolkadotVaultProvider => {
  const { persist, getNetworkInfo } = {
    persist: localStorageProvider(polkadotVaultProviderId),
    ...opts,
  };

  const [vaultAccounts$, setVaultAccounts] = persistedState(
    persist,
    [] as VaultAccountInfo[]
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
    genesis: accountGenesis,
  }: VaultAccountInfo): PolkadotSigner => {
    const info = getSs58AddressInfo(address);
    if (!info.isValid) {
      throw new Error("Invalid SS58 address " + address);
    }

    const publicKey = info.publicKey;

    return {
      publicKey,
      async signBytes(data) {
        const qrPayload = createQrMessage(
          VaultQrEncryption.Sr25519,
          publicKey,
          data,
          Binary.fromHex(accountGenesis).asBytes()
        );
        setTx(qrPayload);

        const signature = await firstValueFrom(currentScannedSignature$);
        if (!signature) {
          throw new Error("Cancelled");
        }

        return signature;
      },
      async signTx(callData, signedExtensions, metadata) {
        let merkleizer: MetadataMerkleizer | null = null;
        const decMeta = unifyMetadata(decAnyMetadata(metadata));
        const extra: Array<Uint8Array> = [];
        const additionalSigned: Array<Uint8Array> = [];
        for (const { identifier } of decMeta.extrinsic.signedExtensions) {
          if (identifier === "CheckMetadataHash") {
            if (getNetworkInfo) {
              merkleizer = merkleizeMetadata(metadata, await getNetworkInfo());
              extra.push(Uint8Array.from([1]));
              additionalSigned.push(
                mergeUint8([Uint8Array.from([1]), merkleizer.digest()])
              );
              continue;
            } else {
              console.warn(
                "The chain supports `CheckMetadataHash`, but `getNetworkInfo` was not provided. Polkadot Vault will need the whole metadata downloaded beforehand."
              );
            }
          }
          const signedExtension = signedExtensions[identifier];
          if (!signedExtension)
            throw new Error(`Missing ${identifier} signed extension`);
          extra.push(signedExtension.value);
          additionalSigned.push(signedExtension.additionalSigned);
        }
        const extensions = mergeUint8([...extra, ...additionalSigned]);

        const genesis =
          signedExtensions.CheckGenesis?.additionalSigned ??
          Binary.fromHex(accountGenesis).asBytes();

        const qrPayload = merkleizer
          ? createQrProofedTransaction(
              VaultQrEncryption.Sr25519,
              publicKey,
              merkleizer.getProofForExtrinsicParts(
                callData,
                mergeUint8(extra),
                mergeUint8(additionalSigned)
              ),
              callData,
              extensions,
              genesis
            )
          : createQrTransaction(
              VaultQrEncryption.Sr25519,
              publicKey,
              callData,
              extensions,
              genesis
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

  const accountInfoToAccount = (
    info: VaultAccountInfo
  ): PolkadotVaultAccount => ({
    provider: polkadotVaultProviderId,
    address: info.address,
    genesis: info.genesis,
    signer: createVaultSigner(info),
  });

  const accounts$ = vaultAccounts$.pipeState(
    map((accounts) => accounts.map(accountInfoToAccount)),
    withDefault([])
  );

  return {
    id: polkadotVaultProviderId,
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
                  addrEq(acc.address, account.address) &&
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
    removeAccount: (account) =>
      setVaultAccounts((v) =>
        v.filter((acc) => acc.address !== account.address)
      ),
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
  ProofTx = 0x06,
  LoadMetadataUpdate = 0x80,
  LoadTypesUpdate = 0x81,
  AddSpecsUpdate = 0xc1,
  DerivationsImport = 0xce,
}

const createQrTransaction = (
  encryption: VaultQrEncryption,
  publicKey: Uint8Array,
  callData: Uint8Array,
  extensions: Uint8Array,
  genesisHash: Uint8Array
) =>
  mergeUint8([
    VAULT_QR_HEADER,
    new Uint8Array([encryption]),
    new Uint8Array([VaultQrPayloadType.Tx]),
    publicKey,
    compact.enc(callData.length),
    callData,
    extensions,
    genesisHash,
  ]);

const createQrProofedTransaction = (
  encryption: VaultQrEncryption,
  publicKey: Uint8Array,
  metadataProof: Uint8Array,
  callData: Uint8Array,
  extensions: Uint8Array,
  genesisHash: Uint8Array
) =>
  mergeUint8([
    VAULT_QR_HEADER,
    new Uint8Array([encryption]),
    new Uint8Array([VaultQrPayloadType.ProofTx]),
    publicKey,
    metadataProof,
    compact.enc(callData.length),
    callData,
    extensions,
    genesisHash,
  ]);

const createQrMessage = (
  encrpytion: VaultQrEncryption,
  publicKey: Uint8Array,
  data: Uint8Array,
  genesisHash: Uint8Array
) =>
  mergeUint8([
    VAULT_QR_HEADER,
    new Uint8Array([encrpytion]),
    new Uint8Array([VaultQrPayloadType.Message]),
    publicKey,
    mergeUint8([
      Binary.fromText("<Bytes>").asBytes(),
      data,
      Binary.fromText("</Bytes>").asBytes(),
    ]),
    genesisHash,
  ]);
