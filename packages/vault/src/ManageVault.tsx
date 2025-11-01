import {
  AddressBalance,
  AddressIdentity,
  ModalContext,
  usePlugin,
} from "@polkahub/context";
import { useSetSelectedAccount } from "@polkahub/select-account";
import { Button, SourceButton } from "@polkahub/ui-components";
import { useStateObservable } from "@react-rxjs/core";
import { Camera, Trash2 } from "lucide-react";
import { getSs58AddressInfo } from "polkadot-api";
import { useCallback, useContext, type FC } from "react";
import vaultImg from "./assets/vault.webp";
import { PolkadotVaultProvider, polkadotVaultProviderId } from "./provider";
import { QrCamera } from "./QrCamera";

export const ManageVault: FC = () => {
  const { pushContent } = useContext(ModalContext)!;
  const polkadotVaultProvider = usePlugin<PolkadotVaultProvider>(
    polkadotVaultProviderId
  );

  return (
    <SourceButton
      label="Vault"
      onClick={() =>
        pushContent({ title: "Vault Accounts", element: <VaultAccounts /> })
      }
      disabled={!polkadotVaultProvider}
    >
      <img src={vaultImg} alt="Vault" className="h-10 rounded" />
    </SourceButton>
  );
};

const VaultAccounts = () => {
  const { pushContent, popContent } = useContext(ModalContext)!;
  const polkadotVaultProvider = usePlugin<PolkadotVaultProvider>(
    polkadotVaultProviderId
  )!;
  const vaultAccounts = useStateObservable(polkadotVaultProvider.accounts$);
  const selectAccount = useSetSelectedAccount();

  return (
    <div className="space-y-4">
      {vaultAccounts.length ? (
        <div>
          <h3 className="font-medium text-muted-foreground">Added addresses</h3>
          <ul className="space-y-2">
            {vaultAccounts.map((acc) => (
              <li
                key={`${acc.address}-${acc.genesis}`}
                className="flex gap-2 items-center"
              >
                <Button
                  variant="outline"
                  className="text-destructive"
                  type="button"
                  onClick={() => polkadotVaultProvider.removeAccount(acc)}
                >
                  <Trash2 />
                </Button>
                <AddressIdentity addr={acc.address} />
                <div className="grow" />
                <AddressBalance addr={acc.address} />
                {selectAccount && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      selectAccount(acc);
                    }}
                  >
                    Select
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground text-center">
          No accounts imported
        </div>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() =>
            pushContent({
              title: "Scan Account",
              element: <ScanAccount onScanned={popContent} />,
            })
          }
        >
          <Camera />
          Scan new account
        </Button>
      </div>
    </div>
  );
};

const ScanAccount: FC<{ onScanned: () => void }> = ({ onScanned }) => {
  const polkadotVaultProvider = usePlugin<PolkadotVaultProvider>(
    polkadotVaultProviderId
  )!;

  return (
    <div className="space-y-2">
      <p>Scan your account QR from the vault app</p>
      <QrCamera
        onRead={useCallback(
          (res) => {
            // Expected format: `substrate:${Addr}:${genesis}`
            const split = res.split(":");
            if (
              split[0] !== "substrate" ||
              split.length != 3 ||
              !split[2].startsWith("0x")
            ) {
              throw new Error("Invalid QR");
            }
            const [, address, genesis] = split;
            const account = getSs58AddressInfo(address);
            if (!account.isValid) {
              throw new Error("Invalid QR");
            }

            polkadotVaultProvider.addAccount({
              address,
              genesis,
            });
            onScanned();
          },
          [onScanned, polkadotVaultProvider]
        )}
      />
    </div>
  );
};
