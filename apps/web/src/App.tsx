import { useEffect, useSyncExternalStore } from "react";
import { Console } from "./components/Console";
import { LoginPage } from "./components/LoginPage";
import { ops } from "./lib/store";

export function App() {
  const state = useSyncExternalStore(ops.subscribe, ops.getState, ops.getState);

  useEffect(() => {
    void ops.bootstrap();
  }, []);

  if (state.token && !state.user) {
    return (
      <div className="login-shell">
        <p>Restoring session...</p>
      </div>
    );
  }
  if (!state.token || !state.user) {
    return <LoginPage />;
  }
  return <Console />;
}
