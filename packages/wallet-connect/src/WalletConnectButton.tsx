import { usePlugin } from "@polkahub/context";
import { state, useStateObservable } from "@react-rxjs/core";
import { of } from "rxjs";
import { SourceButton } from "../../ui-components/dist/src";
import wcLogo from "./assets/walletConnect.svg";
import { WalletConnectProvider, walletConnectProviderId } from "./provider";

const null$ = state(of(null), null);
export const WalletConnectButton = () => {
  const walletConnectProvider = usePlugin<WalletConnectProvider>(
    walletConnectProviderId
  );
  const status = useStateObservable(
    walletConnectProvider?.walletConnectStatus$ ?? null$
  );

  return (
    <SourceButton
      label="Wallet Connect"
      onClick={walletConnectProvider?.toggleWalletConnect}
      isSelected={status?.type === "connected"}
      disabled={!status}
    >
      <img src={wcLogo} alt="Wallet Connect" className="h-10 rounded" />
    </SourceButton>
  );
};
