import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

const AuthCallback = (): JSX.Element => {
  useEffect(() => {
    supabase.auth.getSession();
  }, []);

  return <p style={{ padding: 24 }}>Signing you in…</p>;
};

export default AuthCallback;
