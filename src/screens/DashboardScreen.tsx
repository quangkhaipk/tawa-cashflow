import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Icon } from '../components/Icon';

const revenueData = [
  { name: 'GrabFood', value: 40, color: '#2A9D8F' },
  { name: 'ShopeeFood', value: 30, color: '#28a745' },
  { name: 'Baemin', value: 15, color: '#80ed99' },
  { name: 'Tại chỗ', value: 15, color: '#57cc99' },
];

const pendingPayments = [
    { platform: 'GrabFood', amount: '4.920.000đ', status: 'Trễ hạn', statusColor: 'loss' },
    { platform: 'ShopeeFood', amount: '3.690.000đ', status: 'Sắp trả', statusColor: 'profit' },
    { platform: 'Baemin', amount: '1.845.000đ', status: 'Sắp trả', statusColor: 'profit' },
];

const StatCard: React.FC<{ title: string; value: string; large?: boolean; valueColor?: string }> = ({ title, value, large = false, valueColor = 'text-gray-900 dark:text-gray-100' }) => (
    <div className={`flex flex-col gap-2 rounded-lg p-5 ${large ? 'p-6 bg-gray-100 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900/70'} border border-gray-200 dark:border-gray-800`}>
        <p className="text-gray-600 dark:text-gray-400 text-base font-medium leading-normal">{title}</p>
        <p className={`tracking-tight ${large ? 'text-4xl' : 'text-2xl'} font-bold leading-tight ${valueColor}`}>{value}</p>
    </div>
);

const DashboardScreen: React.FC = () => {
  return (
    <div className="flex flex-col pb-28">
        {/* ActionPanel (Alert) */}
        <div className="p-4 @container">
            <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-lg border border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20 p-5 @[480px]:flex-row @[480px]:items-center">
                <div className="flex flex-col gap-1">
                    <p className="text-yellow-900 dark:text-yellow-200 text-base font-bold leading-tight flex items-center gap-2">
                        <Icon name="warning" className="!text-xl text-yellow-600 dark:text-yellow-400" />
                        Cảnh báo quan trọng
                    </p>
                    <p className="text-yellow-800 dark:text-yellow-300 text-base font-normal leading-normal">GrabFood đã trễ hạn thanh toán 2 ngày</p>
                </div>
                <a className="text-sm font-bold leading-normal tracking-[0.015em] flex gap-2 text-yellow-900 dark:text-yellow-200" href="#">
                    Xem chi tiết
                    <Icon name="arrow_forward" className="!text-xl" />
                </a>
            </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 px-4">
            <div className="w-full">
                <StatCard title="Lãi/Lỗ Hôm Nay" value="+5.200.000đ" large valueColor="text-profit" />
            </div>
            <div className="flex-1 min-w-[calc(50%-0.5rem)]">
                 <StatCard title="Tổng Doanh Thu" value="12.300.000đ" />
            </div>
            <div className="flex-1 min-w-[calc(50%-0.5rem)]">
                <StatCard title="Tổng Chi Phí" value="7.100.000đ" />
            </div>
            <div className="w-full">
                <StatCard title="Tiền mặt & Ngân hàng" value="25.680.000đ" />
            </div>
        </div>

        {/* Donut Chart */}
        <div className="px-4 pt-6">
            <div className="flex flex-col gap-4 rounded-lg bg-white dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 p-5">
                <h3 className="text-gray-900 dark:text-gray-100 text-lg font-bold leading-tight tracking-[-0.015em]">Cơ cấu Doanh Thu Hôm Nay</h3>
                <div className="flex flex-col @container @[480px]:flex-row items-center gap-6">
                    <div className="relative flex items-center justify-center w-40 h-40">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={revenueData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={70} startAngle={90} endAngle={450} paddingAngle={2}>
                                    {revenueData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Tổng</span>
                            <span className="text-xl font-bold text-gray-800 dark:text-gray-200">12.3M</span>
                        </div>
                    </div>
                    <div className="flex-1 w-full grid grid-cols-2 gap-x-4 gap-y-3">
                        {revenueData.map((item) => (
                            <div key={item.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="text-sm text-gray-700 dark:text-gray-300">{item.name} ({item.value}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
        
        {/* Pending Payments List */}
        <h3 className="text-gray-900 dark:text-gray-100 text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-6">Dòng tiền chờ về từ App</h3>
        <div className="flex flex-col gap-3 px-4 pb-6">
            {pendingPayments.map((payment) => (
                <div key={payment.platform} className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col">
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{payment.platform}</p>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{payment.amount}</p>
                    </div>
                    <span className={`text-xs font-bold text-${payment.statusColor} bg-${payment.statusColor}/10 px-2.5 py-1 rounded-full`}>{payment.status}</span>
                </div>
            ))}
        </div>
    </div>
  );
};

export default DashboardScreen;
