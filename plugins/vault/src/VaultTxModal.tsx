import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@polkahub/ui-components";
import { useStateObservable } from "@react-rxjs/core";
import { Camera, ChevronLeft } from "lucide-react";
import { Binary } from "polkadot-api";
import { mergeUint8 } from "polkadot-api/utils";
import { useCallback, useEffect, useState, type FC } from "react";
import encodeQr from "./qr";
import { QrCamera } from "./QrCamera";
import { usePlugin } from "@polkahub/context";
import { PolkadotVaultProvider, polkadotVaultProviderId } from "./provider";

export const VaultTxModal: FC = () => {
  const polkadotVaultProvider = usePlugin<PolkadotVaultProvider>(
    polkadotVaultProviderId
  )!;
  const activeTx = useStateObservable(polkadotVaultProvider.activeTx$);

  return (
    <Dialog open={!!activeTx} onOpenChange={polkadotVaultProvider.cancelTx}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vault Transaction</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VaultTxContent activeTx={activeTx} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

const VaultTxContent: FC<{
  activeTx: Uint8Array<ArrayBufferLike> | null;
}> = ({ activeTx }) => {
  const polkadotVaultProvider = usePlugin<PolkadotVaultProvider>(
    polkadotVaultProviderId
  )!;
  const [mode, setMode] = useState<"tx" | "sig">("tx");

  const onRead = useCallback(
    (res: string) => polkadotVaultProvider.setSignature(Binary.fromHex(res)),
    [polkadotVaultProvider]
  );

  if (mode === "tx") {
    return (
      <div className="flex flex-col items-center gap-2">
        <VaultTx tx={activeTx} />
        <Button type="button" variant="outline" onClick={() => setMode("sig")}>
          <Camera />
          Scan Signature
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <QrCamera onRead={onRead} />
      <Button type="button" variant="outline" onClick={() => setMode("tx")}>
        <ChevronLeft />
        Back
      </Button>
    </div>
  );
};

const uint8ToB64 = (value: Uint8Array) => {
  if ("toBase64" in value) {
    return (value as any).toBase64() as string;
  }

  let binary = "";
  for (let i = 0; i < value.length; i++) {
    binary += String.fromCharCode(value[i]);
  }
  return window.btoa(binary);
};

const VaultTx: FC<{
  tx: Uint8Array<ArrayBufferLike> | null;
}> = ({ tx }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!tx) return;

    const frames = createFrames(tx);
    const drawFrame = (frame: Uint8Array) => {
      const encoded = encodeQr(binaryToString(frame), "gif", {
        encoding: "byte",
        textEncoder: stringToBinary,
        scale: 4,
      });

      setImgSrc(`data:image/gif;base64,${uint8ToB64(encoded)}`);
    };
    drawFrame(frames[0]);

    if (frames.length === 1) return;

    let i = 1;
    const token = setInterval(() => {
      drawFrame(frames[i]);
      i = (i + 1) % frames.length;
    }, 300);
    return () => clearInterval(token);
  }, [tx]);

  return (
    <div className="text-center">
      <p>Scan the transaction with your device</p>
      <img src={imgSrc ?? undefined} className="m-auto" />
    </div>
  );
};

const binaryToString = (value: Uint8Array) =>
  Array.from(value, (b) => String.fromCharCode(b)).join("");
const stringToBinary = (value: string) =>
  Uint8Array.from(value, (c) => c.charCodeAt(0) & 0xff);

const createFrames = (payload: Uint8Array): Uint8Array[] => {
  const frames = [];
  const MAX_FRAME_SIZE = 1024;
  const frameAmount = Math.ceil(payload.length / MAX_FRAME_SIZE);
  const frameSize = Math.ceil(payload.length / frameAmount);

  let idx = 0;
  while (idx < payload.length) {
    frames.push(payload.subarray(idx, idx + frameSize));
    idx += frameSize;
  }

  return frames.map(
    (f, i): Uint8Array =>
      mergeUint8([
        new Uint8Array([0x00]),
        Binary.fromHex(frames.length.toString(16).padStart(4, "0")),
        Binary.fromHex(i.toString(16).padStart(4, "0")),
        f,
      ])
  );
};
