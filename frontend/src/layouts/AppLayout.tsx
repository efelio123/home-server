import { NavLink, Outlet } from 'react-router';

const navigationItems = [
  { to: '/', label: 'Dashboard', icon: 'pi pi-home', end: true },
  { to: '/chores', label: 'Chores', icon: 'pi pi-check-square' },
  {
    to: '/shopping-list',
    label: 'Shopping List',
    icon: 'pi pi-shopping-cart',
  },
];

function AppLayout() {
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
                    `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                  }
                >
                  <i className={item.icon} aria-hidden="true" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="page-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;