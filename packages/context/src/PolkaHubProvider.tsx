import type { PolkaHub } from "@polkahub/state";
import { useStateObservable } from "@react-rxjs/core";
import { FC, PropsWithChildren, useMemo } from "react";
import { AvailableAccountsContext } from "./availableAccountsContext";
import { PolkaHubContext } from "./polkahubContext";

type ProviderProps = PropsWithChildren<{
  polkaHub: PolkaHub;
}>;
export const PolkaHubProvider: FC<ProviderProps> = ({ children, polkaHub }) => {
  const availableAccounts = useStateObservable(polkaHub.availableAccounts$);

  return (
    <PolkaHubContext
      value={useMemo(
        () => ({
          polkaHub,
        }),
        [polkaHub]
      )}
    >
      <AvailableAccountsContext
        value={useMemo(() => ({ availableAccounts }), [availableAccounts])}
      >
        {children}
      </AvailableAccountsContext>
    </PolkaHubContext>
  );
};
