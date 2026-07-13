import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ensureProfile } from "./db";
import { autoSettleBets } from "./autoSettle";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        ensureProfile(
          data.session.user.id,
          data.session.user.email.split("@")[0],
        ).catch(console.error);
        autoSettleBets().catch(console.error);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          ensureProfile(
            session.user.id,
            session.user.email.split("@")[0],
          ).catch(console.error);
          autoSettleBets().catch(console.error);
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        signOut,
        loading: session === undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
