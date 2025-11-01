import {
  AddressBalance,
  AddressIdentity,
  ModalContext,
  plugin$,
  usePlugin,
  usePolkaHubContext,
} from "@polkahub/context";
import { useSetSelectedAccount } from "@polkahub/select-account";
import {
  Button,
  CardPlaceholder,
  Checkbox,
  SourceButton,
} from "@polkahub/ui-components";
import { state, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { ChevronLeft, Trash2, Usb } from "lucide-react";
import { FC, ReactElement, useContext, useEffect } from "react";
import {
  catchError,
  concatMap,
  debounceTime,
  filter,
  map,
  Observable,
  startWith,
  switchMap,
  take,
} from "rxjs";
import ledgerImg from "./assets/ledger.webp";
import {
  LedgerAccount,
  LedgerAccountInfo,
  LedgerProvider,
  ledgerProviderId,
} from "./provider";

export const ManageLedger = () => {
  const { setContent } = useContext(ModalContext)!;
  const ledgerProvider = usePlugin<LedgerProvider>(ledgerProviderId);

  return (
    <SourceButton
      label="Ledger"
      onClick={() => setContent(<LedgerAccounts setContent={setContent} />)}
      disabled={!ledgerProvider}
    >
      <img src={ledgerImg} alt="Ledger" className="h-10 rounded" />
    </SourceButton>
  );
};

const LedgerAccounts: FC<{
  setContent: (element: ReactElement | null) => void;
}> = ({ setContent }) => {
  const ledgerProvider = usePlugin<LedgerProvider>(ledgerProviderId)!;
  const ledgerAccounts = useStateObservable(ledgerProvider.accounts$);
  const setAccount = useSetSelectedAccount();

  useEffect(() => {
    if (ledgerAccounts.length === 0) {
      setContent(
        <ImportAccounts
          onClose={(accounts) =>
            setContent(
              accounts.length ? (
                <LedgerAccounts setContent={setContent} />
              ) : null
            )
          }
        />
      );
    }
  }, [ledgerAccounts, setContent]);

  return (
    <div className="space-y-4">
      {ledgerAccounts.length ? (
        <div>
          <h3 className="font-medium text-muted-foreground">Added addresses</h3>
          <ul className="space-y-2">
            {ledgerAccounts.map((acc) => (
              <li
                key={`${acc.address}-${acc.deviceId}-${acc.index}`}
                className="flex gap-2 items-center"
              >
                <Button
                  variant="outline"
                  className="text-destructive"
                  type="button"
                  onClick={() => ledgerProvider.removeAccount(acc)}
                >
                  <Trash2 />
                </Button>
                <AddressIdentity addr={acc.address} />
                <div className="grow" />
                <AddressBalance addr={acc.address} />
                {setAccount && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAccount(acc);
                    }}
                  >
                    Select
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex items-center justify-between flex-wrap-reverse gap-2">
        <Button
          onClick={() => setContent(null)}
          variant="secondary"
          type="button"
        >
          <ChevronLeft />
          Back
        </Button>
        <Button
          type="button"
          onClick={() =>
            setContent(
              <ImportAccounts
                onClose={() =>
                  setContent(<LedgerAccounts setContent={setContent} />)
                }
              />
            )
          }
        >
          <Usb />
          Import accounts
        </Button>
      </div>
    </div>
  );
};

const PAGE_SIZE = 5;

const [pageChange$, setPage] = createSignal<number>();
const page$ = state(pageChange$, 0);
type PageAccounts = {
  accounts: Array<LedgerAccountInfo | null>;
  error: string | null;
};
const pageAccounts$ = state(
  (ctxId: string) =>
    page$.pipe(
      // React might mess it up with a double re-render.
      debounceTime(200),
      map((page) =>
        new Array(PAGE_SIZE).fill(0).map((_, i) => page * PAGE_SIZE + i)
      ),
      concatMap((idxs): Observable<PageAccounts> => {
        const value: PageAccounts = {
          accounts: idxs.map(() => null),
          error: null,
        };

        return plugin$<LedgerProvider>(ctxId, ledgerProviderId).pipe(
          filter((v) => v != null),
          take(1),
          switchMap((ledgerProvider) =>
            ledgerProvider.getLedgerAccounts$(idxs)
          ),
          map((account, i) => {
            value.accounts[i] = account;

            return { ...value };
          }),
          startWith({ ...value }),
          catchError((ex) => {
            console.error(ex);
            return [
              {
                ...value,
                error: ex.message,
              },
            ];
          })
        );
      })
    ),
  {
    accounts: new Array(PAGE_SIZE).fill(null),
    error: null,
  } as PageAccounts
);

const ImportAccounts: FC<{ onClose: (accounts: LedgerAccount[]) => void }> = ({
  onClose,
}) => {
  const { id } = usePolkaHubContext();
  const ledgerProvider = usePlugin<LedgerProvider>(ledgerProviderId)!;
  const ledgerAccounts = useStateObservable(ledgerProvider.accounts$);
  const page = useStateObservable(page$);
  const { accounts, error } = useStateObservable(pageAccounts$(id));

  const allLoading = accounts.every((v) => v == null);
  const allLoaded = accounts.every((v) => v != null);

  return (
    <div className="space-y-2">
      {error ? (
        <div>Error: {error}</div>
      ) : allLoading ? (
        <CardPlaceholder height={152} />
      ) : (
        <ul className="space-y-2">
          {accounts.map((acc, i) => (
            <li key={i} className="flex gap-2 items-center">
              {acc ? (
                <>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {acc.index}.
                  </div>
                  <Checkbox
                    checked={ledgerAccounts.some(
                      (v) =>
                        v.deviceId === acc.deviceId &&
                        v.index === acc.index &&
                        v.address === acc.address
                    )}
                    onCheckedChange={(chk) => {
                      if (chk) {
                        ledgerProvider.addAccount(acc);
                      } else {
                        ledgerProvider.removeAccount(acc);
                      }
                    }}
                  />
                  <AddressIdentity addr={acc.address} />
                  <div className="grow" />
                  <AddressBalance addr={acc.address} />
                </>
              ) : (
                <div className="bg-muted w-full rounded shadow animate-pulse h-6" />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between">
        <Button
          onClick={() => onClose(ledgerAccounts)}
          variant="secondary"
          type="button"
        >
          <ChevronLeft />
          Back
        </Button>
        {allLoaded ? (
          <Button
            onClick={() => setPage(page + 1)}
            variant="secondary"
            type="button"
          >
            Next Page
          </Button>
        ) : null}
      </div>
    </div>
  );
};
