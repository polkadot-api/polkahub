import {
  PolkadotIdenticon,
  sliceMiddleStr,
} from "@polkadot-api/react-components";
import { AccountId } from "@polkadot-api/substrate-bindings";
import { useIdentity } from "@polkahub/context";
import { Button, cn } from "@polkahub/ui-components";
import {
  forwardRef,
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
  type ComponentProps,
} from "react";
import { useSelectedAccount } from "./provider";

export const SelectedAccountButton: ForwardRefExoticComponent<
  ComponentProps<typeof Button> & {
    loading?: boolean;
    noAccountContent?: ReactNode;
  } & RefAttributes<HTMLButtonElement>
> = forwardRef(({ loading, noAccountContent, ...props }, ref) => {
  const [selectedAccount] = useSelectedAccount();
  const identity = useIdentity(selectedAccount?.address ?? null);
  const identityName = identity
    ? identity.name + (identity.subId ? `/${identity.subId}` : "")
    : null;

  if (!selectedAccount)
    return (
      <Button ref={ref} {...props}>
        {noAccountContent ?? "Connect"}
      </Button>
    );

  const publicKey = AccountId().enc(selectedAccount.address);

  const name = selectedAccount?.name ?? identityName;

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
          {sliceMiddleStr(selectedAccount.address, 12)}
        </div>
      )}
    </Button>
  );
});
