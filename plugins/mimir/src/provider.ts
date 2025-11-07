import { isMimirReady, MIMIR_REGEXP } from "@mimirdev/apps-inject";
import { MimirPAPISigner } from "@mimirdev/papi-signer";
import {
  Account,
  addrEq,
  localStorageProvider,
  persistedState,
  PersistenceProvider,
  Plugin,
} from "@polkahub/plugin";
import { DefaultedStateObservable, state, withDefault } from "@react-rxjs/core";
import {
  defer,
  filter,
  firstValueFrom,
  from,
  map,
  Observable,
  switchMap,
} from "rxjs";

export const mimirProviderId = "mimir";
export interface MimirProvider extends Plugin {
  id: "mimir";
  accounts$: DefaultedStateObservable<Account[]>;

  isReady$: DefaultedStateObservable<boolean>;
  isActive$: DefaultedStateObservable<boolean>;
  toggle: () => void;
}

export const createMimirProvider = (
  origin: string,
  opts?: Partial<{
    persist: PersistenceProvider;
  }>
): MimirProvider => {
  const { persist } = {
    persist: localStorageProvider(mimirProviderId),
    ...opts,
  };

  const signer = new MimirPAPISigner();
  const [enabled$, setEnabled] = persistedState(persist, false);

  const isReady$ = state(
    defer(isMimirReady).pipe(
      map((origin) => (origin ? MIMIR_REGEXP.test(origin) : false))
    ),
    false
  );
  const isActive$ = enabled$.pipeState(
    switchMap((enabled) => {
      if (!enabled) return [false];

      return from(signer.enable(origin)).pipe(map(({ result }) => result));
    }),
    withDefault(false)
  );

  const accounts$ = isActive$.pipeState(
    switchMap((isActive) => {
      if (!isActive) return [[]];
      return new Observable<Account[]>((obs) =>
        signer.subscribeAccounts((accounts) =>
          obs.next(
            accounts.map(
              (account): Account => ({
                provider: mimirProviderId,
                address: account.address,
                name: account.name,
                signer: signer.getPolkadotSigner(account.address),
              })
            )
          )
        )
      );
    }),
    withDefault([])
  );

  return {
    id: mimirProviderId,
    deserialize: (account) =>
      firstValueFrom(
        accounts$.pipe(
          map((accounts) =>
            accounts.find((acc) => addrEq(acc.address, account.address))
          ),
          filter((v) => v != null)
        )
      ),
    accounts$,
    toggle: () => setEnabled((e) => !e),
    isActive$,
    isReady$,
  };
};
