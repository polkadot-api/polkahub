import {
  AddressBalance,
  AddressIdentity,
  externalizePlugin,
  ModalContext,
  usePlugin,
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
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  TriangleAlert,
  Usb,
} from "lucide-react";
import { FC, useContext } from "react";
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
  LedgerAccountInfo,
  LedgerProvider,
  ledgerProviderId,
} from "./provider";

export const ManageLedger = () => {
  const { pushContent } = useContext(ModalContext)!;
  const ledgerProvider = usePlugin<LedgerProvider>(ledgerProviderId);

  return (
    <SourceButton
      label="Ledger"
      onClick={() =>
        pushContent({ title: "Ledger Accounts", element: <LedgerAccounts /> })
      }
      disabled={!ledgerProvider}
    >
      <img src={ledgerImg} alt="Ledger" className="h-10 rounded" />
    </SourceButton>
  );
};

const LedgerAccounts: FC = () => {
  const { pushContent, popContent } = useContext(ModalContext)!;
  const ledgerProvider = usePlugin<LedgerProvider>(ledgerProviderId)!;
  const ledgerAccounts = useStateObservable(ledgerProvider.accounts$);
  const setAccount = useSetSelectedAccount();

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
              title: "Import Ledger Accounts",
              element: <ImportAccounts onClose={popContent} />,
            })
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

const [plugin$, useLedgerProvider] =
  externalizePlugin<LedgerProvider>(ledgerProviderId);

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

        return plugin$(ctxId).pipe(
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

const ImportAccounts: FC<{ onClose: () => void }> = ({ onClose }) => {
  const [id, ledgerProvider] = useLedgerProvider();
  const ledgerAccounts = useStateObservable(ledgerProvider!.accounts$);
  const page = useStateObservable(page$);
  const { accounts, error } = useStateObservable(pageAccounts$(id));

  const allLoading = accounts.every((v) => v == null);
  const allLoaded = accounts.every((v) => v != null);

  const PLACEHOLDER_HEIGHT = 232;

  return (
    <div className="space-y-2">
      {error ? (
        <div className="space-y-2" style={{ height: PLACEHOLDER_HEIGHT }}>
          <div className="flex items-center gap-1">
            <TriangleAlert className="text-destructive" />
            <p>Error: {error}</p>
          </div>
          <Button type="button" onClick={() => setPage(page)}>
            Retry
          </Button>
        </div>
      ) : allLoading ? (
        <CardPlaceholder height={PLACEHOLDER_HEIGHT} />
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
                        ledgerProvider!.addAccount(acc);
                      } else {
                        ledgerProvider!.removeAccount(acc);
                      }
                    }}
                  />
                  <AddressIdentity addr={acc.address} />
                  <div className="grow" />
                  <AddressBalance addr={acc.address} />
                </>
              ) : (
                <div className="bg-muted w-full rounded shadow animate-pulse h-10" />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setPage(page - 1)}
            variant="secondary"
            type="button"
            disabled={!allLoaded || page == 0}
          >
            <ChevronLeft />
            Prev
          </Button>
          <Button
            onClick={() => setPage(page + 1)}
            variant="secondary"
            type="button"
            disabled={!allLoaded}
          >
            Next
            <ChevronRight />
          </Button>
        </div>
        <Button onClick={onClose} type="button">
          Done
        </Button>
      </div>
    </div>
  );
};
