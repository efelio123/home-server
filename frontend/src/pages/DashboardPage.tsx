import { useEffect, useState } from 'react';
import { ApiError, getOpenChores, getShoppingListItems } from '../api/client';
import type { Chore, ShoppingListItem } from '../api/types';
import DashboardCard from '../components/DashboardCard';

function formatDueDate(dueDate: string | null) {
  if (!dueDate) {
    return 'No due date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dueDate}T00:00:00`));
}

function formatQuantity(quantity: number, unit: string | null) {
  return unit ? `${quantity} ${unit}` : String(quantity);
}

function DashboardPage() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [loadedChores, loadedShoppingItems] = await Promise.all([
          getOpenChores(),
          getShoppingListItems(),
        ]);

        setChores(loadedChores);
        setShoppingItems(loadedShoppingItems);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setErrorMessage('Log in through the API page, then refresh this dashboard.');
        } else {
          setErrorMessage('Unable to load dashboard data. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  return (
    <>
      <header className="page-header">
        <p className="page-header__eyebrow">HOME SERVER</p>
        <h1>Family Dashboard</h1>
        <p className="page-header__subtitle">
          A shared view of what matters today.
        </p>
      </header>

      <section className="dashboard-grid" aria-label="Dashboard cards">
        <DashboardCard title="Today" icon="pi pi-calendar">
          <p>Today</p>
        </DashboardCard>

        <DashboardCard title="Chores" icon="pi pi-check-square">
          {isLoading && <p>Loading chores…</p>}

          {!isLoading && errorMessage && (
            <p className="dashboard-card__error">{errorMessage}</p>
          )}

          {!isLoading && !errorMessage && chores.length === 0 && (
            <p>No open chores. Nice work!</p>
          )}

          {!isLoading && !errorMessage && chores.length > 0 && (
            <ul className="dashboard-card__list">
              {chores.map((chore) => (
                <li key={chore.id}>
                  <div>
                    <strong>{chore.title}</strong>
                    <span>{chore.assignee_name ?? 'Unassigned'}</span>
                  </div>
                  <time>{formatDueDate(chore.due_date)}</time>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="Shopping List" icon="pi pi-shopping-cart">
          {isLoading && <p>Loading shopping list…</p>}

          {!isLoading && errorMessage && (
            <p className="dashboard-card__error">{errorMessage}</p>
          )}

          {!isLoading && !errorMessage && shoppingItems.length === 0 && (
            <p>Your shopping list is empty.</p>
          )}

          {!isLoading && !errorMessage && shoppingItems.length > 0 && (
            <ul className="dashboard-card__list">
              {shoppingItems.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.item_name}</strong>
                    <span>{item.category ?? 'Uncategorized'}</span>
                  </div>
                  <span>{formatQuantity(item.quantity, item.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="Weather" icon="pi pi-cloud-sun">
          <p>Weather information will appear here.</p>
        </DashboardCard>
      </section>
    </>
  );
}

export default DashboardPage;