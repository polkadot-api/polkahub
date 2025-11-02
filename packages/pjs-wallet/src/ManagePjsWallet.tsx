import { externalizePlugin, usePlugin } from "@polkahub/context";
import { cn, SourceButton } from "@polkahub/ui-components";
import { state, useStateObservable } from "@react-rxjs/core";
import { CircleQuestionMark } from "lucide-react";
import { type FC } from "react";
import { filter, switchMap } from "rxjs";
import nova from "./assets/nova.webp";
import pjs from "./assets/pjs.webp";
import subwallet from "./assets/subwallet.webp";
import talisman from "./assets/talisman.webp";
import { PjsWalletProvider, pjsWalletProviderId } from "./provider";

const knownExtensions: Record<string, { name: string; logo: string }> = {
  "polkadot-js": {
    name: "Polkadot JS",
    logo: pjs,
  },
  "nova-wallet": {
    name: "Nova Wallet",
    logo: nova,
  },
  talisman: {
    name: "Talisman",
    logo: talisman,
  },
  "subwallet-js": {
    name: "Subwallet",
    logo: subwallet,
  },
};

const [pjsWalletPlugin$, useExternalizedPlugin] =
  externalizePlugin<PjsWalletProvider>(pjsWalletProviderId);

const availableExtensions$ = state(
  (id: string) =>
    pjsWalletPlugin$(id).pipe(
      filter((plugin) => plugin != null),
      switchMap((plugin) => plugin.availableExtensions$)
    ),
  []
);

export const ManagePjsWallets: FC = () => {
  const [id] = useExternalizedPlugin();
  const availableExtensions = useStateObservable(availableExtensions$(id)).sort(
    (a, b) => (b in knownExtensions ? 1 : 0) - (a in knownExtensions ? 1 : 0)
  );

  if (!availableExtensions) return null;

  return (
    <div>
      <h3>Manage Extensions</h3>
      <PjsWalletButtons />
    </div>
  );
};

export const PjsWalletButtons: FC<{ className?: string }> = ({ className }) => {
  const [ctxId] = useExternalizedPlugin();
  const availableExtensions = useStateObservable(
    availableExtensions$(ctxId)
  ).sort(
    (a, b) => (b in knownExtensions ? 1 : 0) - (a in knownExtensions ? 1 : 0)
  );

  if (!availableExtensions) return null;

  return (
    <ul
      className={cn(
        "flex gap-2 flex-wrap items-center justify-center",
        className
      )}
    >
      {availableExtensions.map((id) => (
        <li key={id}>
          <ExtensionButton id={id} ctxId={ctxId} />
        </li>
      ))}
    </ul>
  );
};

const connectedExtensions$ = state(
  (id: string) =>
    pjsWalletPlugin$(id).pipe(
      filter((plugin) => plugin != null),
      switchMap((plugin) => plugin.connectedExtensions$)
    ),
  []
);

const ExtensionButton: FC<{
  id: string;
  ctxId: string;
}> = ({ id, ctxId }) => {
  const provider = usePlugin<PjsWalletProvider>(pjsWalletProviderId);
  const knownExtension = knownExtensions[id];
  const connectedExtensions = useStateObservable(connectedExtensions$(ctxId));
  const isSelected = connectedExtensions.includes(id);

  const setConnectedExtensions = (extensions: string[]) => {
    if (!provider) {
      throw new Error("PjsWallet provider not found");
    }
    provider.setConnectedExtensions(extensions);
  };

  return (
    <SourceButton
      isSelected={isSelected}
      label={knownExtension?.name ?? id}
      onClick={() =>
        setConnectedExtensions(
          isSelected
            ? connectedExtensions.filter((v) => v !== id)
            : [...connectedExtensions, id]
        )
      }
    >
      {knownExtension ? (
        <img
          src={knownExtension.logo}
          alt={knownExtension.name}
          className="h-10 rounded"
        />
      ) : (
        <div>
          <CircleQuestionMark
            className="size-10 text-muted-foreground"
            strokeWidth={1}
          />
        </div>
      )}
    </SourceButton>
  );
};
