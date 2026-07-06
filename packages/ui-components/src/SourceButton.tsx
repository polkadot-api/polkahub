import { FC, MouseEvent, PropsWithChildren } from "react"
import { Button } from "./Button"
import { cn } from "./utils"

export const SourceButton: FC<
  PropsWithChildren<{
    label: string
    isSelected?: boolean
    className?: string
    onClick?: (evt: MouseEvent) => void
    disabled?: boolean
  }>
> = ({ label, isSelected, onClick, className, children, disabled }) => (
  <Button
    variant="outline"
    className={cn("h-auto min-w-40", isSelected ? "bg-accent" : "")}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
    <div className="text-left">
      <span className={cn("font-bold", className)}>{label}</span>
    </div>
  </Button>
)
