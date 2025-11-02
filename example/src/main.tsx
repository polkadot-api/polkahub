import { PolkaHubProvider } from "polkahub";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { polkaHub } from "./accounts.ts";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PolkaHubProvider polkaHub={polkaHub}>
      <App />
    </PolkaHubProvider>
  </StrictMode>
);
