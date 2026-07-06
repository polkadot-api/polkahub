import type { FC } from "react"

export const CardPlaceholder: FC<{ height?: number }> = ({ height = 100 }) => (
  <div
    className="bg-muted w-full rounded-xl shadow animate-pulse"
    style={{ height }}
  />
)
