import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

setBaseUrl(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api");
setAuthTokenGetter(() => localStorage.getItem("zhengji_token"));

createRoot(document.getElementById("root")!).render(<App />);
