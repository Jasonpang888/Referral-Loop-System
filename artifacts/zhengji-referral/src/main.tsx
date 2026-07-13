import { createRoot } from "react-dom/client";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080").replace(/\/api\/?$/, "");

setBaseUrl(apiBaseUrl);
setAuthTokenGetter(() => localStorage.getItem("zhengji_token"));

createRoot(document.getElementById("root")!).render(<App />);
