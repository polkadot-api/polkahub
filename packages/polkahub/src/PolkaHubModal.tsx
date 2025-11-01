import { ModalContext } from "@polkahub/context";
import { SelectedAccountButton } from "@polkahub/select-account";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@polkahub/ui-components";
import { state, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { FC, PropsWithChildren, ReactNode, useMemo, useState } from "react";

// For lazy-loading optimizations
export const PolkaHubModalTrigger: FC = () => <SelectedAccountButton loading />;

const [openChange$, setOpen] = createSignal<boolean>();
export const openSelectAccount = () => setOpen(true);
const open$ = state(openChange$, false);

export const PolkaHubModal: FC<PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => {
  const open = useStateObservable(open$);

  const [content, setContent] = useState<ReactNode | null>(null);

  const contextValue = useMemo(
    () => ({ setContent, closeModal: () => setOpen(false) }),
    []
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setTimeout(() => setContent(null), 500);
        }
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <SelectedAccountButton className={className} />
      </DialogTrigger>
      <DialogContent
        onInteractOutside={(evt) => {
          if (
            evt.target instanceof HTMLElement &&
            evt.target.tagName === "WCM-MODAL"
          )
            evt.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Connect</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <ModalContext value={contextValue}>
            {content ?? <div className="space-y-4">{children}</div>}
          </ModalContext>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
