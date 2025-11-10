import {
  AddressBalance,
  AddressIdentity,
  ModalContext,
  useModalContext,
  usePlugin,
} from "@polkahub/context";
import { Button, SourceButton } from "@polkahub/ui-components";
import { Trash2, UserLock } from "lucide-react";
import { useContext, type FC } from "react";
import { AddProxy, AddProxyProps } from "./AddProxy";
import { ProxyProvider, proxyProviderId } from "./provider";
import { useStateObservable } from "@react-rxjs/core";
import { useSetSelectedAccount } from "@polkahub/select-account";

export const ManageProxy: FC<{
  maxAddrLength?: number;
}> = ({ ...props }) => {
  const { pushContent } = useContext(ModalContext)!;
  const proxyProvider = usePlugin<ProxyProvider>(proxyProviderId);

  return (
    <SourceButton
      label="Proxy"
      onClick={() =>
        pushContent({
          title: "Proxied accounts",
          element: <ManageAddresses {...props} />,
        })
      }
      disabled={!proxyProvider}
    >
      <div>
        <UserLock className="size-10" />
      </div>
    </SourceButton>
  );
};

const ManageAddresses: FC<AddProxyProps> = ({ maxAddrLength, ...props }) => {
  const { pushContent } = useModalContext();
  const proxyProvider = usePlugin<ProxyProvider>(proxyProviderId)!;
  const proxyAccounts = useStateObservable(proxyProvider.accounts$);
  const setAccount = useSetSelectedAccount();

  return (
    <div className="space-y-4">
      {proxyAccounts.length ? (
        <div>
          <h3 className="font-medium text-muted-foreground">Added addresses</h3>
          <ul className="space-y-2">
            {proxyAccounts.map((account, i) => (
              <li key={i} className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  className="text-destructive"
                  type="button"
                  onClick={() => proxyProvider.removeProxy(account.info)}
                >
                  <Trash2 />
                </Button>
                <AddressIdentity
                  addr={account.address}
                  maxAddrLength={maxAddrLength}
                />
                <div className="grow" />
                <AddressBalance addr={account.address} />
                {setAccount ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAccount(account);
                    }}
                  >
                    Select
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() =>
            pushContent({
              title: "Add Proxy",
              element: <AddProxy maxAddrLength={maxAddrLength} {...props} />,
            })
          }
        >
          Add Proxy
        </Button>
      </div>
    </div>
  );
};
