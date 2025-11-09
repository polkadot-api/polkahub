import { OctagonX, TriangleAlert } from "lucide-react";
import { FC, PropsWithChildren, ReactNode } from "react";
import { cn } from "./utils";

export interface AlertBoxVariant {
  classNames: string;
  icon: ReactNode;
}

const variants = {
  warn: {
    classNames: "bg-amber-100/50 border-amber-400 text-amber-800",
    icon: <TriangleAlert className="shrink-0" />,
  },
  error: {
    classNames: "bg-rose-100/50 border-rose-600 text-rose-800",
    icon: <OctagonX className="shrink-0" />,
  },
} satisfies Record<string, AlertBoxVariant>;

export const AlertBox: FC<
  PropsWithChildren<{
    variant?: "warn" | "error" | AlertBoxVariant;
    className?: string;
  }>
> = ({ variant = "warn", className, children }) => {
  const { classNames, icon } =
    typeof variant === "string" ? variants[variant] : variant;

  return (
    <div
      className={cn(
        "p-2 flex gap-2 border-2 rounded-lg text-sm",
        classNames,
        className
      )}
    >
      {icon}
      <div>{children}</div>
    </div>
  );
};
