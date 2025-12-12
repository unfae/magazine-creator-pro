import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { SessionContextProvider } from '@supabase/auth-helpers-react';


createRoot(document.getElementById("root")!).render(<App />);

<SessionContextProvider supabaseClient={supabase}>
  <App />
</SessionContextProvider>