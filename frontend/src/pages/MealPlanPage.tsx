import { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";

import { getMealPlanEntries } from "../api/client";
import type { MealPlanEntry } from "../api/types";
import { AddMealDialog } from "../components/AddMealDialog";

import "./MealPlanPage.css";

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);

  return result;
}

function getMonday(date: Date) {
  const result = new Date(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;

  result.setDate(result.getDate() - daysSinceMonday);
  result.setHours(0, 0, 0, 0);

  return result;
}

function toDateParameter(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function MealPlanPage() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const entriesByDate = useMemo(() => {
    return entries.reduce<Record<string, MealPlanEntry[]>>(
      (groupedEntries, entry) => {
        const existingEntries = groupedEntries[entry.planned_for] ?? [];

        groupedEntries[entry.planned_for] = [...existingEntries, entry];

        return groupedEntries;
      },
      {},
    );
  }, [entries]);

  useEffect(() => {
    async function loadMealPlan() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await getMealPlanEntries(toDateParameter(weekStart));

        setEntries(response);
      } catch {
        setErrorMessage("Unable to load the meal plan. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadMealPlan();
  }, [weekStart, refreshVersion]);

  const weekEnd = addDays(weekStart, 6);

  return (
    <section className="meal-plan-page">
      <div className="meal-plan-page__header">
        <div>
          <h1>Meal Plan</h1>
          <p>
            {weekStart.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}{" "}
            –{" "}
            {weekEnd.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="meal-plan-page__actions">
          <Button
            aria-label="Previous week"
            icon="pi pi-angle-left"
            outlined
            onClick={() => setWeekStart((current) => addDays(current, -7))}
          />
          <Button
            label="This week"
            outlined
            onClick={() => setWeekStart(getMonday(new Date()))}
          />
          <Button
            aria-label="Next week"
            icon="pi pi-angle-right"
            outlined
            onClick={() => setWeekStart((current) => addDays(current, 7))}
          />
        </div>
      </div>

      {errorMessage && <Message severity="error" text={errorMessage} />}

      {isLoading ? (
        <div className="meal-plan-page__loading">
          <ProgressSpinner />
        </div>
      ) : (
        <div className="meal-plan-grid">
          {weekDays.map((day) => {
            const dateKey = toDateParameter(day);
            const dayEntries = entriesByDate[dateKey] ?? [];

            return (
              <article className="meal-plan-day" key={dateKey}>
                <header>
                  <span>
                    {day.toLocaleDateString(undefined, {
                      weekday: "short",
                    })}
                  </span>
                  <strong>{day.getDate()}</strong>
                </header>

                {dayEntries.length === 0 ? (
                  <p className="meal-plan-day__empty">No meal planned</p>
                ) : (
                  <div className="meal-plan-day__entries">
                    {dayEntries.map((entry) => (
                      <div className="meal-plan-entry" key={entry.id}>
                        <span>{entry.meal_slot}</span>
                        <strong>{entry.recipe_name}</strong>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  className="meal-plan-day__add"
                  icon="pi pi-plus"
                  label="Add meal"
                  outlined
                  size="small"
                  onClick={() => setSelectedDay(dateKey)}
                />
              </article>
            );
          })}
        </div>
      )}
      <AddMealDialog
        plannedFor={selectedDay ?? toDateParameter(weekStart)}
        visible={selectedDay !== null}
        onHide={() => setSelectedDay(null)}
        onCreated={() =>
          setRefreshVersion((currentVersion) => currentVersion + 1)
        }
      />
    </section>
  );
}

export default MealPlanPage
