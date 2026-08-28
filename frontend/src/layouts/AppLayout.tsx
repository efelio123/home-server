import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";

type AppLayoutProps = {
  username: string;
  onLogout: () => Promise<void>;
};

const navigationItems = [
  { to: "/", label: "Dashboard", icon: "pi pi-home", end: true },
  {
    to: "/shopping-list",
    label: "Shopping List",
    icon: "pi pi-shopping-cart",
  },
  {
    to: "/meal-plan",
    label: "Meal Planning",
    icon: "pi pi-calendar",
  },
];

const secondaryNavigationItems = [
  { to: "/pantry", label: "Pantry", icon: "pi pi-box" },
  { to: "/household-members", label: "Household Members", icon: "pi pi-users" },
];

function AppLayout({ username, onLogout }: AppLayoutProps) {
  const location = useLocation();
  const [isRecipesExpanded, setIsRecipesExpanded] = useState(
    location.pathname.startsWith("/recipes"),
  );
  const isRecipesActive = location.pathname.startsWith("/recipes");

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <i className="pi pi-home" aria-hidden="true" />
          <span>Home Server</span>
        </div>

        <nav aria-label="Main navigation">
          <ul className="sidebar__nav">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                  }
                >
                  <i className={item.icon} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
            <li className="sidebar__recipe-menu">
              <button
                type="button"
                className={`sidebar__recipe-toggle ${isRecipesActive ? "sidebar__recipe-toggle--active" : ""}`}
                aria-expanded={isRecipesExpanded}
                onClick={() => setIsRecipesExpanded((isExpanded) => !isExpanded)}
              >
                <i className="pi pi-book" aria-hidden="true" />
                <span>Recipes</span>
                <i
                  className={isRecipesExpanded ? "pi pi-chevron-down" : "pi pi-chevron-right"}
                  aria-hidden="true"
                />
              </button>
              {isRecipesExpanded && (
                <ul className="sidebar__recipe-subnav">
                  <li>
                    <NavLink
                      to="/recipes/library"
                      className={({ isActive }) => `sidebar__recipe-sublink ${isActive ? "sidebar__recipe-sublink--active" : ""}`}
                    >
                      <i className="pi pi-list" aria-hidden="true" />
                      <span>Library</span>
                    </NavLink>
                  </li>
                  <li>
                    <NavLink
                      to="/recipes/explore"
                      className={({ isActive }) => `sidebar__recipe-sublink ${isActive ? "sidebar__recipe-sublink--active" : ""}`}
                    >
                      <i className="pi pi-compass" aria-hidden="true" />
                      <span>Explore</span>
                    </NavLink>
                  </li>
                </ul>
              )}
            </li>
            {secondaryNavigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                  }
                >
                  <i className={item.icon} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar__footer">
          <span>Signed in as {username}</span>
          <button
            type="button"
            className="sidebar__logout"
            onClick={() => void onLogout()}
          >
            <i className="pi pi-sign-out" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
