import {
  AccountId,
  Binary,
  getMultisigAccountId,
  HexString,
} from "@polkadot-api/substrate-bindings";
import { CreateMultisigSigner, MultisigInfo } from "./provider";
import { createSignal } from "@react-rxjs/utils";
import { state, useStateObservable } from "@react-rxjs/core";
import { filter, firstValueFrom } from "rxjs";
import { FC } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@polkahub/ui-components";

const [urlChange$, setUrl] = createSignal<string | null>();
const url$ = state(urlChange$, null);

const [enc] = AccountId();
export const multisigExternalSigner =
  (
    getMultisigUrl: (info: MultisigInfo, callData: HexString) => string,
    thresholdOneFallback?: CreateMultisigSigner
  ): CreateMultisigSigner =>
  (info, signer) => {
    if (info.threshold === 1 && signer && thresholdOneFallback)
      return thresholdOneFallback(info, signer);

    const publicKey = getMultisigAccountId({
      threshold: info.threshold,
      signatories: info.signatories.map(enc),
    });

    return {
      publicKey,
      signBytes() {
        throw new Error("Raw bytes can't be signed with a multisig");
      },
      async signTx(callData) {
        const url = getMultisigUrl(info, Binary.toHex(callData));
        setUrl(url);
        try {
          await firstValueFrom(url$.pipe(filter((v) => !v)));
          throw null;
        } catch (ex) {
          throw new Error("Dismissed");
        }
      },
    };
  };

export const MultisigExternalSignerModal: FC = () => {
  const activeTx = useStateObservable(url$);

  return (
    <Dialog open={!!activeTx} onOpenChange={() => setUrl(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Multisig Transaction</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div>
            <p>
              To sign this multisig transaction, please share the following URL
              with the signatories
            </p>
            <a
              href={activeTx ?? ""}
              target="_blank"
              className="cursor-pointer underline"
            >
              {activeTx}
            </a>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
