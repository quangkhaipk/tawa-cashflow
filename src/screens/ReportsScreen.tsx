import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from 'recharts';
import { Icon } from '../components/Icon';


const lineChartData = [
    { name: 'T2', pv: 18, amt: 2400 },
    { name: 'T3', pv: 24, amt: 2210 },
    { name: 'T4', pv: 10, amt: 2290 },
    { name: 'T5', pv: 30, amt: 2000 },
    { name: 'T6', pv: 20, amt: 2181 },
    { name: 'T7', pv: 40, amt: 2500 },
    { name: 'CN', pv: 15, amt: 2100 },
];

const pieChartData = [
    { name: 'GrabFood', value: 40, color: '#28a745' },
    { name: 'ShopeeFood', value: 30, color: '#f59e0b' },
    { name: 'Baemin', value: 15, color: '#0ea5e9' },
    { name: 'Tại chỗ', value: 15, color: '#8b5cf6' },
];

const PLData = [
    { label: 'Doanh thu thuần (Net Revenue)', value: '113.630.000đ', color: 'text-zinc-900 dark:text-zinc-100' },
    { label: 'Giá vốn hàng bán (COGS)', value: '-45.450.000đ', color: 'text-red-600 dark:text-red-500' },
    { label: 'Lợi nhuận gộp (Gross Profit)', value: '68.180.000đ', color: 'text-zinc-900 dark:text-zinc-100' },
    { label: 'Chi phí vận hành (OpEx)', value: '-33.180.000đ', color: 'text-red-600 dark:text-red-500' },
];

const ReportsScreen: React.FC = () => {
    return (
        <div className="flex flex-col pb-28">
            <main className="flex-1 p-4">
                {/* Segmented Buttons */}
                <div className="flex py-3">
                    <div className="flex h-10 flex-1 items-center justify-center rounded-lg bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
                        {['Hôm nay', 'Tuần này', 'Tháng này'].map((label, index) => (
                            <label key={label} className="flex h-full flex-1 cursor-pointer items-center justify-center rounded-md px-2 text-sm font-medium leading-normal text-zinc-500 has-[:checked]:bg-background-light has-[:checked]:text-zinc-900 has-[:checked]:shadow-sm dark:text-zinc-400 dark:has-[:checked]:bg-zinc-700 dark:has-[:checked]:text-zinc-50">
                                <span className="truncate">{label}</span>
                                <input className="invisible w-0" name="time-filter" type="radio" value={label} defaultChecked={index === 1} />
                            </label>
                        ))}
                        <label className="flex h-full flex-shrink-0 cursor-pointer items-center justify-center rounded-md px-2 text-sm font-medium leading-normal text-zinc-500 has-[:checked]:bg-background-light has-[:checked]:text-zinc-900 has-[:checked]:shadow-sm dark:text-zinc-400 dark:has-[:checked]:bg-zinc-700 dark:has-[:checked]:text-zinc-50">
                            <Icon name="calendar_today" className="!text-base" />
                            <input className="invisible w-0" name="time-filter" type="radio" value="custom" />
                        </label>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/80 bg-background-light p-4 dark:border-zinc-800/80 dark:bg-zinc-900/50">
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Tổng Doanh thu</p>
                        <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">125.000.000đ</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/80 bg-background-light p-4 dark:border-zinc-800/80 dark:bg-zinc-900/50">
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Lợi nhuận ròng</p>
                        <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">35.000.000đ</p>
                    </div>
                    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/80 bg-background-light p-4 dark:border-zinc-800/80 dark:bg-zinc-900/50 sm:col-span-2 lg:col-span-1">
                        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Tổng số đơn hàng</p>
                        <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">1.200</p>
                    </div>
                </div>

                {/* Trend Chart */}
                <div className="flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-background-light p-4 py-6 dark:border-zinc-800/80 dark:bg-zinc-900/50">
                    <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">Xu hướng Doanh thu & Lợi nhuận</p>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={lineChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <defs><linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#19e680" stopOpacity={0.4}/><stop offset="95%" stopColor="#19e680" stopOpacity={0}/></linearGradient></defs>
                                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill: 'rgb(113 113 122)', fontSize: 12}} dy={10} />
                                <Area type="monotone" dataKey="pv" stroke="#19e680" strokeWidth={2.5} fill="url(#colorPv)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Pie Chart */}
                    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-background-light p-4 py-6 dark:border-zinc-800/80 dark:bg-zinc-900/50">
                        <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">Tỷ trọng Doanh thu theo Kênh</p>
                         <div className="flex flex-col items-center gap-6 sm:flex-row">
                             <div className="relative flex h-36 w-36 items-center justify-center">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={60} startAngle={90} endAngle={450}>
                                        {pieChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />))}
                                        </Pie>
                                    </PieChart>
                                 </ResponsiveContainer>
                                 <div className="absolute flex flex-col items-center">
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Tổng</span>
                                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">125M</span>
                                </div>
                             </div>
                             <div className="flex flex-1 flex-col gap-3">
                                {pieChartData.map(item => (
                                    <div key={item.name} className="flex items-center gap-3">
                                        <div className="h-2.5 w-2.5 rounded-full" style={{backgroundColor: item.color}}></div>
                                        <span className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">{item.name}</span>
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{item.value}%</span>
                                    </div>
                                ))}
                             </div>
                         </div>
                    </div>
                    {/* P&L Table */}
                    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-background-light p-4 py-6 dark:border-zinc-800/80 dark:bg-zinc-900/50">
                        <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">Chi tiết Lãi & Lỗ</p>
                        <div className="flex flex-col gap-3">
                            {PLData.map(item => (
                                <div key={item.label} className="flex justify-between border-b border-dashed border-zinc-200/80 pb-3 dark:border-zinc-800/80">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{item.label}</span>
                                    <span className={`font-semibold ${item.color}`}>{item.value}</span>
                                </div>
                            ))}
                            <div className="flex justify-between pt-2">
                                <span className="font-bold text-zinc-900 dark:text-zinc-100">Lợi nhuận ròng (Net Profit)</span>
                                <span className="font-bold text-green-600 dark:text-primary">35.000.000đ</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ReportsScreen;
