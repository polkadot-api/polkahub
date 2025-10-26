import {
  PropsWithChildren,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

export const CopyText: React.FC<
  PropsWithChildren<{
    text: string;
    copiedIndicator: ReactNode;
    disabled?: boolean;
    className?: string;
  }>
> = ({ text, className, children, copiedIndicator, disabled }) => {
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);

  const copy = async (evt: React.MouseEvent) => {
    if (disabled) return;
    evt.stopPropagation();

    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  useEffect(() => {
    if (copied) {
      setTimeout(() => setCopied(false), 1000);
    }
  }, [copied]);

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    const handleEvt = (evt: MouseEvent) => evt.preventDefault();
    element.addEventListener("click", handleEvt);
    return () => element.removeEventListener("click", handleEvt);
  }, []);

  return (
    <button
      ref={ref}
      aria-label="copy"
      disabled={disabled || copied}
      className={className}
      type="button"
      onClick={copy}
      tabIndex={-1}
    >
      {copied ? copiedIndicator : children}
    </button>
  );
};
