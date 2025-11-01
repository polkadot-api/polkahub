import type { FC, PropsWithChildren } from "react";
import { cn } from "./lib/utils";

export const Card: FC<PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => (
  <div className={cn("bg-card rounded-xl shadow p-4 space-y-2", className)}>
    {children}
  </div>
);
