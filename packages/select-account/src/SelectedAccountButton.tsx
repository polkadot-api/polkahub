import {
  PolkadotIdenticon,
  sliceMiddleStr,
} from "@polkadot-api/react-components";
import { AccountId } from "@polkadot-api/substrate-bindings";
import { identityProvider$, usePolkaHubContext } from "@polkahub/context";
import { state, useStateObservable } from "@react-rxjs/core";
import {
  forwardRef,
  ForwardRefExoticComponent,
  RefAttributes,
  type ComponentProps,
} from "react";
import { combineLatest, map, switchMap } from "rxjs";
import { Button, cn } from "@polkahub/ui-components";
import { selectedAccount$, useSelectedAccount } from "./provider";

const selectedAccountName$ = state(
  (id: string) =>
    combineLatest([selectedAccount$(id), identityProvider$(id)]).pipe(
      switchMap(([account, identityProvider]) => {
        if (!account) return [null];

        return identityProvider(account.address);
      }),
      map((v) => (v ? v.value + (v.subId ? `/${v.subId}` : "") : null))
    ),
  null
);

export const SelectedAccountButton: ForwardRefExoticComponent<
  ComponentProps<typeof Button> & {
    loading?: boolean;
  } & RefAttributes<HTMLButtonElement>
> = forwardRef<
  HTMLButtonElement,
  ComponentProps<typeof Button> & {
    loading?: boolean;
  }
>(({ loading, ...props }, ref) => {
  const ctx = usePolkaHubContext();
  const [selectedAccount] = useSelectedAccount();
  const accountName = useStateObservable(selectedAccountName$(ctx.id));

  if (!selectedAccount)
    return (
      <Button ref={ref} {...props}>
        Connect
      </Button>
    );

  const publicKey = AccountId().enc(selectedAccount.address);

  const name = selectedAccount?.name ?? accountName;

  return (
    <Button
      ref={ref}
      variant="outline"
      {...props}
      className={cn(loading ? "cursor-wait" : null, props.className)}
    >
      <PolkadotIdenticon publicKey={publicKey} className="size-6" />
      {name ? (
        <div>{name}</div>
      ) : (
        <div className="text-sm text-foreground/60">
          {sliceMiddleStr(selectedAccount.address, 6)}
        </div>
      )}
    </Button>
  );
});
