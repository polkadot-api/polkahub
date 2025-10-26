import { AccountId, SS58String } from "@polkadot-api/substrate-bindings";
import { CheckCircle } from "lucide-react";
import { FC } from "react";
import { CopyText } from "./CopyText";
import { PolkadotIdenticon } from "./PolkadotIdenticon";
import "./AccountDisplay.css";

export type AccountInfo = {
  address: SS58String;
  name?: string;
  subId?: string;
  verified?: boolean;
};

const SplitText: FC<{ children: string }> = ({ children }) => (
  <span className="SplitText">
    <span className="first">{children.slice(0, children.length / 2)}</span>
    <span className="second">{children.slice(children.length / 2)}</span>
  </span>
);

export const AccountDisplay: FC<{
  account: AccountInfo;
  copyable?: boolean;
  showAddress?: boolean;
  className?: string;
  maxAddrLength?: number;
}> = ({
  account,
  className,
  showAddress = !account.verified,
  copyable = true,
  maxAddrLength,
}) => {
  const addr = maxAddrLength
    ? sliceMiddleStr(account.address, maxAddrLength)
    : account.address;

  return (
    <div
      className={["AccountDisplay", ...(className ? [className] : [])].join(
        " "
      )}
    >
      {copyable ? (
        <CopyText
          text={account.address}
          copiedIndicator={
            <div className="AccountDisplay_copied">
              <CheckCircle size={18} className="text-positive shrink-0" />
            </div>
          }
        >
          <PolkadotIdenticon
            className="Identicon"
            publicKey={getPublicKey(account.address)}
          />
        </CopyText>
      ) : (
        <PolkadotIdenticon
          className="Identicon"
          publicKey={getPublicKey(account.address)}
        />
      )}
      {account.name ? (
        !showAddress ? (
          <div className="AccountDisplay_name-display">
            <div>
              <span className="AccountDisplay_name">{account.name.trim()}</span>
              {account.subId ? (
                <>
                  <span className="AccountDisplay_subIdSeparator">/</span>
                  <span className="AccountDisplay_subId">
                    {account.subId?.trim()}
                  </span>
                </>
              ) : null}
            </div>
            <CheckCircle size={18} className="text-positive shrink-0" />
          </div>
        ) : (
          <div className="AccountDisplay_full-info">
            <div>
              <span className="AccountDisplay_name">{account.name.trim()}</span>
              {account.subId ? (
                <>
                  <span className="AccountDisplay_subIdSeparator">/</span>
                  <span className="AccountDisplay_subId">
                    {account.subId?.trim()}
                  </span>
                </>
              ) : null}
            </div>
            <SplitText>{addr}</SplitText>
          </div>
        )
      ) : (
        <SplitText>{addr}</SplitText>
      )}
    </div>
  );
};
const getPublicKey = AccountId().enc;

// eslint-disable-next-line react-refresh/only-export-components
export const sliceMiddleStr = (s: string, length: number) => {
  if (length >= s.length) return s;
  const half = Math.floor(length / 2);
  return s.slice(0, half) + "…" + s.slice(-half);
};
