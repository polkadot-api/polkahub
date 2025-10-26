import { Plugin } from "@polkahub/plugin";
import { state, useStateObservable } from "@react-rxjs/core";
import type { SS58String } from "polkadot-api";
import { FC, PropsWithChildren, useEffect, useId } from "react";
import { EMPTY, merge } from "rxjs";
import { Identity, PolkaHubContext } from "./context";
import {
  addInstance,
  availableAccounts$,
  changeIdentityProvider,
  removeInstance,
  setPlugins,
} from "./state";

const defaultedAvailableAccounts$ = state(
  (id: string) => availableAccounts$(id),
  {}
);

type ProviderProps = PropsWithChildren<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: Plugin<any>[];
  getIdentity?: (address: SS58String) => Promise<Identity | null>;
}>;
export const PolkaHubProvider: FC<ProviderProps> = ({
  children,
  plugins,
  getIdentity = async () => null,
}) => {
  const id = useId();
  const availableAccounts = useStateObservable(defaultedAvailableAccounts$(id));

  useEffect(() => {
    addInstance(id);
    return () => {
      removeInstance(id);
    };
  }, [id]);

  useEffect(() => {
    const sub = merge(plugins.map((p) => p.subscription$ ?? EMPTY)).subscribe();
    setPlugins(id, plugins);

    return () => sub.unsubscribe();
  }, [id, plugins]);

  useEffect(() => {
    changeIdentityProvider(id, getIdentity);
  }, [id, getIdentity]);

  return (
    <PolkaHubContext
      value={{
        id,
        plugins,
        getIdentity,
        availableAccounts,
      }}
    >
      {children}
    </PolkaHubContext>
  );
};
