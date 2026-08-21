import { Navigate, Route, Routes } from 'react-router';
import AppLayout from './layouts/AppLayout';
import ChoresPage from './pages/ChoresPage';
import DashboardPage from './pages/DashboardPage';
import ShoppingListPage from './pages/ShoppingListPage';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="chores" element={<ChoresPage />} />
        <Route path="shopping-list" element={<ShoppingListPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;