import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Every authenticated request must carry the bearer token from localStorage.
// Without this registration, customFetch never attaches an Authorization
// header and every protected endpoint (including GET /api/auth/me, which
// AuthContext depends on to know who's logged in) 401s regardless of role -
// silently stranding every user on the login screen after a successful login.
setAuthTokenGetter(() => localStorage.getItem("zhengji_token"));

createRoot(document.getElementById("root")!).render(<App />);
