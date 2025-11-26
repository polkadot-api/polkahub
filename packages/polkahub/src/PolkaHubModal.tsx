import { ModalContext, usePlugin } from "@polkahub/context";
import { Account, addrEq } from "@polkahub/plugin";
import {
  SelectedAccountButton,
  SelectedAccountPlugin,
  selectedAccountPluginId,
} from "@polkahub/select-account";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@polkahub/ui-components";
import { state, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { ChevronLeft } from "lucide-react";
import {
  ComponentProps,
  FC,
  PropsWithChildren,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

// For lazy-loading optimizations
export const PolkaHubModalTrigger: FC = () => <SelectedAccountButton loading />;

const [openChange$, setOpen] = createSignal<boolean>();
export const openSelectAccount = () => setOpen(true);
const open$ = state(openChange$, false);
const close = () => setOpen(false);

export type PolkaHubModalClassnames = {
  button?: string
  modalContent?: string
  modalHeader?: string
  modalBody?: string
}

export const PolkaHubModal: FC<
  PropsWithChildren<{
    className?: PolkaHubModalClassnames;
    buttonProps?: ComponentProps<typeof SelectedAccountButton>;
    title?: string;
  }>
> = ({ children, buttonProps, className, title = "Connect" }) => {
  const open = useStateObservable(open$);
  const selectedAccountPlugin = usePlugin<SelectedAccountPlugin>(
    selectedAccountPluginId
  );

  const { contentStack, contextValue } = usePolkaHubModalState(close);
  const activeContent = contentStack.length
    ? contentStack[contentStack.length - 1]
    : null;

  useEffect(() => {
    if (!selectedAccountPlugin) return;

    let first = true;
    let prev: Account | null = null;
    const sub = selectedAccountPlugin.selectedAccount$.subscribe((acc) => {
      if (first) {
        first = false;
        prev = acc;
        return;
      }
      if (addrEq(prev?.address, acc?.address)) return;
      prev = acc;
      // Only close when setting an account, not when resetting it.
      if (acc) contextValue.closeModal();
    });

    return () => sub.unsubscribe();
  }, [selectedAccountPlugin, contextValue]);

  return (
    <Dialog
      open={open}
      onOpenChange={(open) =>
        open ? setOpen(true) : contextValue.closeModal()
      }
    >
      <DialogTrigger asChild>
        <SelectedAccountButton className={className?.button} {...buttonProps} />
      </DialogTrigger>
      <DialogContent className={className?.modalContent}
        onInteractOutside={(evt) => {
          if (
            evt.target instanceof HTMLElement &&
            evt.target.tagName === "WCM-MODAL"
          )
            evt.preventDefault();
        }}
      >
        <DialogHeader className={"flex-row items-center ".concat(className?.modalHeader || "")}>
          {contentStack.length ? (
            <Button
              className="has-[>svg]:px-1"
              type="button"
              variant="ghost"
              onClick={() => contextValue.popContent()}
            >
              <ChevronLeft />
            </Button>
          ) : null}
          <DialogTitle>{activeContent?.title ?? title}</DialogTitle>
        </DialogHeader>
        <DialogBody className={className?.modalBody}>
          <ModalContext value={contextValue}>
            {activeContent ? (
              activeContent.element
            ) : (
              <div className="space-y-4">{children}</div>
            )}
          </ModalContext>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export const usePolkaHubModalState = (onClose?: () => void) => {
  const [contentStack, setContentStack] = useState<
    { title?: string; element: ReactNode }[]
  >([]);

  const contextValue = useMemo(() => {
    const ctx: ModalContext = {
      replaceContent: (element: { title?: string; element: ReactNode }) =>
        element == null
          ? ctx.popContent()
          : setContentStack((stack) => {
              const newStack = [...stack];
              const i = Math.max(newStack.length - 1, 0);
              newStack[i] = element;
              return newStack;
            }),
      pushContent: (element: { title?: string; element: ReactNode }) =>
        setContentStack((stack) =>
          element == null ? stack : [...stack, element]
        ),
      popContent: () =>
        setContentStack((stack) => {
          const newStack = [...stack];
          newStack.pop();
          return newStack;
        }),
      closeModal: () => {
        // Remove stack after small duration, otherwise the content might flash as the dialog is transitioning away
        setTimeout(() => setContentStack([]), 250);
        onClose?.();
      },
    };
    return ctx;
  }, [onClose]);
  return { contentStack, contextValue, setContentStack };
};
