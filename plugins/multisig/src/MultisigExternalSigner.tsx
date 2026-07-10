import { getMultisigTxCreator } from "@polkadot-api/meta-signers"
import { getDynamicBuilder, getLookupFn } from "@polkadot-api/metadata-builders"
import {
  AccountId,
  decAnyMetadata,
  getMultisigAccountId,
  HexString,
  unifyMetadata,
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
import { defer, filter, firstValueFrom, map, Observable } from "rxjs"
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

    const creator: TxCreator<any> = async (txPayload, opts, bindings, fake) => {
      const {
        callData,
        context: { metadata, bestBlockHash },
      } = txPayload
      if (fake) {
        if (!signer) throw new Error("Needs a parent signer to fake sign")

        const multisigSigner = getMultisigTxCreator(
          info,
          async () => undefined,
          paymentInfoFromBindings(metadata, bestBlockHash, bindings),
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

let cachedBuilder: {
  metadata: string
  builder: ReturnType<typeof getDynamicBuilder>
} | null = null
const getCachedBuilder = (metadata: string) => {
  if (cachedBuilder?.metadata !== metadata)
    cachedBuilder = {
      metadata,
      builder: getDynamicBuilder(
        getLookupFn(unifyMetadata(decAnyMetadata(metadata))),
      ),
    }
  return cachedBuilder.builder
}

const paymentInfoFromBindings =
  (
    metadata: string,
    block: string,
    bindings: {
      call: (
        call: string,
        args: Uint8Array,
        at: string,
      ) => Observable<Uint8Array>
    },
  ) =>
  (uxt: Uint8Array, len: number) =>
    firstValueFrom(
      defer(() => {
        const dynamicBuilder = getCachedBuilder(metadata)
        const codecs = dynamicBuilder.buildRuntimeCall(
          "TransactionPaymentApi",
          "query_info",
        )

        return bindings
          .call(
            "TransactionPaymentApi_query_info",
            codecs.args.enc([uxt, len]),
            block,
          )
          .pipe(
            map(
              (res) =>
                codecs.value.dec(res) as {
                  weight: {
                    ref_time: bigint
                    proof_size: bigint
                  }
                },
            ),
          )
      }),
    )
