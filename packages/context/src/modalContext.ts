import { createContext, ReactNode, useContext } from "react";

export interface ModalContext {
  closeModal: () => void;
  replaceContent: (element: { title?: string; element: ReactNode }) => void;
  pushContent: (element: { title?: string; element: ReactNode }) => void;
  popContent: () => void;
}
export const ModalContext = createContext<ModalContext | null>(null);
export const useModalContext = () => {
  const ctx = useContext(ModalContext);
  if (!ctx) {
    throw new Error("Missing ModalContext");
  }
  return ctx;
};
