import type { ReactNode } from 'react';
import { Card } from 'primereact/card';

type DashboardCardProps = {
  title: string;
  icon: string;
  children: ReactNode;
};

function DashboardCard({ title, icon, children }: DashboardCardProps) {
  return (
    <Card className="dashboard-card">
      <div className="dashboard-card__title">
        <i className={icon} aria-hidden="true" />
        <h2>{title}</h2>
      </div>

      <div className="dashboard-card__content">{children}</div>
    </Card>
  );
}

export default DashboardCard;