import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router";
import { ApiError, getCurrentUser, logout } from "./api/client";
import type { AuthenticatedUser } from "./api/types";
import AppLayout from "./layouts/AppLayout";
import ChoresPage from "./pages/ChoresPage";
import DashboardPage from "./pages/DashboardPage";
import ShoppingListPage from "./pages/ShoppingListPage";
import LoginPage from "./pages/LoginPage";
import { MealPlanPage } from "./pages/MealPlanPage";

function App() {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null,
  );
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          setSessionError("Unable to check your session. Please refresh.");
        }
      } finally {
        setIsCheckingSession(false);
      }
    }

    void loadSession();
  }, []);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setCurrentUser(null);
    }
  }

  if (isCheckingSession) {
    return <main className="app-message">Checking your session...</main>;
  }

  if (sessionError) {
    return <main className="app-message">{sessionError}</main>;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          currentUser ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={setCurrentUser} />
          )
        }
      />

      <Route
        element={
          currentUser ? (
            <AppLayout
              username={currentUser.username}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="chores" element={<ChoresPage />} />
        <Route path="shopping-list" element={<ShoppingListPage />} />
        <Route path="meal-plan" element={<MealPlanPage />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={currentUser ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}

export default App;
