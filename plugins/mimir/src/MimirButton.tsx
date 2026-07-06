import { usePlugin } from "@polkahub/context"
import { state, useStateObservable } from "@react-rxjs/core"
import { of } from "rxjs"
import { SourceButton } from "@polkahub/ui-components"
import mimirLogo from "./assets/mimir.png"
import { MimirProvider, mimirProviderId } from "./provider"

const false$ = state(of(false), false)
export const MimirButton = () => {
  const mimirPovider = usePlugin<MimirProvider>(mimirProviderId)
  const isReady = useStateObservable(mimirPovider?.isReady$ ?? false$)
  const isActive = useStateObservable(mimirPovider?.isActive$ ?? false$)

  return (
    <SourceButton
      label="Mimir"
      onClick={mimirPovider?.toggle}
      isSelected={isActive}
      disabled={!isReady}
    >
      <img src={mimirLogo} alt="Mimir" className="h-10 rounded" />
    </SourceButton>
  )
}
