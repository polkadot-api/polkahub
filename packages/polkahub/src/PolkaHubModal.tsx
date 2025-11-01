import { ModalContext } from "@polkahub/context";
import { SelectedAccountButton } from "@polkahub/select-account";
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
  useMemo,
  useState,
} from "react";

// For lazy-loading optimizations
export const PolkaHubModalTrigger: FC = () => <SelectedAccountButton loading />;

const [openChange$, setOpen] = createSignal<boolean>();
export const openSelectAccount = () => setOpen(true);
const open$ = state(openChange$, false);

export const PolkaHubModal: FC<
  PropsWithChildren<{
    className?: string;
    buttonProps?: ComponentProps<typeof SelectedAccountButton>;
    title?: string;
  }>
> = ({ children, buttonProps, className, title = "Connect" }) => {
  const open = useStateObservable(open$);

  const [contentStack, setContentStack] = useState<
    { title?: string; element: ReactNode }[]
  >([]);

  const contextValue = useMemo(() => {
    const ctx = {
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
      closeModal: () => setOpen(false),
    };
    return ctx;
  }, []);

  const activeContent = contentStack.length
    ? contentStack[contentStack.length - 1]
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setTimeout(() => setContentStack([]), 500);
        }
        setOpen(open);
      }}
    >
      <DialogTrigger asChild>
        <SelectedAccountButton className={className} {...buttonProps} />
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
        <DialogHeader className="flex-row items-center">
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
        <DialogBody>
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
