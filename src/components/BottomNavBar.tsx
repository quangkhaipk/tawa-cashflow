import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';

interface NavItemProps {
  to: string;
  icon: string;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  const colorClass = isActive ? 'text-primary' : 'text-text-light-secondary dark:text-text-dark-secondary';

  return (
    <Link to={to} className="flex flex-col items-center justify-center gap-1 w-full h-full">
      <Icon name={icon} className={`transition-colors ${colorClass}`} />
      <span className={`text-xs font-bold transition-colors ${colorClass}`}>{label}</span>
    </Link>
  );
};

export const BottomNavBar: React.FC<{ onAddClick: () => void }> = ({ onAddClick }) => {
  return (
    <nav className="sticky bottom-0 z-20 h-20 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark flex items-center justify-around">
      <div className="w-full h-full">
        <NavItem to="/" icon="dashboard" label="Tổng quan" />
      </div>
      <div className="w-full h-full">
        <NavItem to="/orders" icon="receipt_long" label="Đơn hàng" />
      </div>
      <div className="w-20 h-full flex items-center justify-center">
        <button 
          onClick={onAddClick}
          className="flex items-center justify-center size-16 bg-primary-alt rounded-full shadow-lg hover:brightness-95 transition-all absolute -top-8"
        >
          <Icon name="add" className="!text-4xl text-background-dark" />
        </button>
      </div>
      <div className="w-full h-full">
        <NavItem to="/ledger" icon="account_balance_wallet" label="Sổ quỹ" />
      </div>
      <div className="w-full h-full">
        <NavItem to="/reports" icon="bar_chart" label="Báo cáo" />
      </div>
    </nav>
  );
};
