import { getMultisigTxCreator } from "@polkadot-api/meta-signers"
import {
  AccountId,
  getMultisigAccountId,
  HexString,
} from "@polkadot-api/substrate-bindings"
import { TxCreator } from "@polkahub/plugin"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@polkahub/ui-components"
import { state, useStateObservable } from "@react-rxjs/core"
import { createSignal } from "@react-rxjs/utils"
import { Link } from "lucide-react"
import { FC } from "react"
import { filter, firstValueFrom } from "rxjs"
import {
  CreateMultisigTxCreator,
  IdentifiedTxCreator,
  MultisigInfo,
} from "./provider"

const [urlChange$, setUrl] = createSignal<string | null>()
const url$ = state(urlChange$, null)

const [enc] = AccountId()
export const multisigExternalSigner =
  <T extends IdentifiedTxCreator>(
    getMultisigUrl: (
      info: MultisigInfo,
      callData: HexString,
    ) => string | Promise<string>,
    thresholdOneFallback?: CreateMultisigTxCreator<T>,
  ): CreateMultisigTxCreator<T> =>
  (info, signer) => {
    if (info.threshold === 1 && signer && thresholdOneFallback)
      return thresholdOneFallback(info, signer)

    const publicKey = getMultisigAccountId({
      threshold: info.threshold,
      signatories: info.signatories.map(enc),
    })

    const creator: TxCreator = async (txPayload, opts, bindings, fake) => {
      const { callData } = txPayload
      if (fake) {
        if (!signer) throw new Error("Needs a parent signer to fake sign")

        const multisigSigner = getMultisigTxCreator(
          info,
          async () => undefined,
          signer,
        )
        return multisigSigner(txPayload, opts, bindings, true)
      }
      const url = await getMultisigUrl(info, callData)
      setUrl(url)
      try {
        await firstValueFrom(url$.pipe(filter((v) => !v)))
        throw null
      } catch (ex) {
        throw new Error("Dismissed")
      }
    }

    return Object.assign(creator as T, {
      accountId: publicKey,
      publicKey,
    })
  }

export const MultisigExternalSignerModal: FC = () => {
  const activeTx = useStateObservable(url$)

  return (
    <Dialog open={!!activeTx} onOpenChange={() => setUrl(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Multisig Transaction</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            To sign this multisig transaction, please share the following URL
            with the signatories:
            <a
              href={activeTx ?? ""}
              target="_blank"
              className="cursor-pointer underline"
            >
              <Link size={16} className="inline-block mx-0.5" />
              Link
            </a>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
