import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GlbImportGatePage } from "./gate/GlbImportGatePage.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlbImportGatePage />
  </StrictMode>,
);
