import { ChevronsUpDown, X } from "lucide-react";
import { ReactNode, useState } from "react";
import { Button } from "./Button";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";
import { cn } from "./utils";

export type AddressInputPopoverProps = {
  hasValue: boolean;
  onClear?: () => void;
  className?: string;
  triggerClassName?: string;
  onOpenChange?: (open: boolean) => void;
  renderValue: () => ReactNode;
  children: (close: () => void) => ReactNode;
};

export function AddressInputPopover({
  className,
  onClear,
  hasValue,
  renderValue,
  triggerClassName,
  onOpenChange,
  children,
}: AddressInputPopoverProps) {
  const [open, _setOpen] = useState(false);
  const setOpen = (value: boolean) => {
    _setOpen(value);
    onOpenChange?.(value);
  };

  const onTriggerKeyDown = (evt: React.KeyboardEvent) => {
    if (evt.key.length === 1) {
      setOpen(true);
    }
  };

  // modal=true is needed because otherwise the command is not selectable nor scrollable
  // see https://github.com/shadcn-ui/ui/issues/4799, https://github.com/shadcn-ui/ui/issues/6488, https://github.com/shadcn-ui/ui/issues/7308, https://github.com/shadcn-ui/ui/issues/7385, etc.
  // Alternatively, see radix-ui override we had at commit a0f3925
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <div
        className={cn(
          "flex items-center gap-2 overflow-hidden w-full max-w-96 relative group",
          className
        )}
      >
        <PopoverTrigger asChild onKeyDown={onTriggerKeyDown}>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "grow shrink-0 p-2 has-[>svg]:p-2 h-12 max-w-full flex justify-between overflow-hidden border border-border bg-background",
              triggerClassName
            )}
          >
            {renderValue()}
            <ChevronsUpDown size={14} className="opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        {onClear && hasValue ? (
          <button
            className="cursor-pointer absolute top-1/2 right-6 -translate-y-1/2 bg-background group-has-hover:bg-accent dark:group-has-hover:bg-input/50 transition-all rounded-full p-1"
            onClick={onClear}
          >
            <X className="text-muted-foreground" size={16} />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-96 p-0">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}
