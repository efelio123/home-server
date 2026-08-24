import { useEffect, useState } from "react";
import {
  ApiError,
  getOpenChores,
  getShoppingListItems,
  getWeather,
} from "../api/client";
import type { Chore, ShoppingListItem, Weather } from "../api/types";
import DashboardCard from "../components/DashboardCard";

function formatDueDate(dueDate: string | null) {
  if (!dueDate) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${dueDate}T00:00:00`));
}

function formatQuantity(quantity: number, unit: string | null) {
  return unit ? `${quantity} ${unit}` : String(quantity);
}

function weatherIcon(condition: string, isDay: boolean) {
  const normalizedCondition = condition.toLowerCase();

  if (normalizedCondition.includes("thunderstorm")) {
    return "pi pi-bolt";
  }

  if (
    normalizedCondition.includes("rain") ||
    normalizedCondition.includes("drizzle")
  ) {
    return "pi pi-cloud-rain";
  }

  if (normalizedCondition.includes("snow")) {
    return "pi pi-snowflake";
  }

  if (
    normalizedCondition.includes("cloud") ||
    normalizedCondition.includes("overcast") ||
    normalizedCondition.includes("fog")
  ) {
    return "pi pi-cloud";
  }

  return isDay ? "pi pi-sun" : "pi pi-moon";
}

function DashboardPage() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [shoppingItems, setShoppingItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // weather
  const [weather, setWeather] = useState<Weather | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);

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
          setErrorMessage(
            "Log in through the API page, then refresh this dashboard.",
          );
        } else {
          setErrorMessage("Unable to load dashboard data. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  useEffect(() => {
    async function loadWeather() {
      try {
        const loadedWeather = await getWeather();
        setWeather(loadedWeather);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setWeatherError("Your session has expired. Please sign in again.");
        } else {
          setWeatherError("Weather is temporarily unavailable.");
        }
      } finally {
        setIsWeatherLoading(false);
      }
    }

    void loadWeather();
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
                    <span>{chore.assignee_name ?? "Unassigned"}</span>
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
                    <span>{item.category ?? "Uncategorized"}</span>
                  </div>
                  <span>{formatQuantity(item.quantity, item.unit)}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="Weather" icon="pi pi-cloud-sun">
          {isWeatherLoading && <p>Loading weather…</p>}

          {!isWeatherLoading && weatherError && (
            <p className="dashboard-card__error">{weatherError}</p>
          )}

          {!isWeatherLoading && weather && (
            <div className="weather-card">
              <div className="weather-card__current">
                <i
                  className={weatherIcon(weather.condition, weather.is_day)}
                  aria-hidden="true"
                />

                <div>
                  <strong>{Math.round(weather.temperature_f)}°</strong>
                  <span>{weather.condition}</span>
                </div>
              </div>

              <dl className="weather-card__details">
                <div>
                  <dt>Feels like</dt>
                  <dd>{Math.round(weather.apparent_temperature_f)}°</dd>
                </div>
                <div>
                  <dt>High</dt>
                  <dd>{Math.round(weather.today_high_f)}°</dd>
                </div>
                <div>
                  <dt>Low</dt>
                  <dd>{Math.round(weather.today_low_f)}°</dd>
                </div>
              </dl>

              <p className="weather-card__location">{weather.location_name}</p>
            </div>
          )}
        </DashboardCard>
      </section>
    </>
  );
}

export default DashboardPage;
