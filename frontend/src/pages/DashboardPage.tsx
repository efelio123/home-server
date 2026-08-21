import DashboardCard from '../components/DashboardCard';

function DashboardPage() {
  return (
    <>
      <header className="page-header">
        <p className="page-header__eyebrow">HOME SERVER</p>
        <h1>Herrera Family Dashboard</h1>
        <p className="page-header__subtitle">
          A shared view of what matters today.
        </p>
      </header>

      <section className="dashboard-grid" aria-label="Dashboard cards">
        <DashboardCard title="Today" icon="pi pi-calendar">
          Your family’s day at a glance will appear here.
        </DashboardCard>

        <DashboardCard title="Chores" icon="pi pi-check-square">
          No chores are due yet.
        </DashboardCard>

        <DashboardCard title="Shopping List" icon="pi pi-shopping-cart">
          Your shared shopping list will appear here.
        </DashboardCard>

        <DashboardCard title="Weather" icon="pi pi-cloud-sun">
          Weather information will appear here.
        </DashboardCard>
      </section>
    </>
  );
}

export default DashboardPage;