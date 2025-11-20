import React, { useState } from 'react';
import { Icon } from '../components/Icon';

const ordersData = [
    { id: 'GRB-124578', date: '2023-10-26', total: '125.000đ', net: '100.000đ' },
    { id: 'GRB-124579', date: '2023-10-26', total: '250.000đ', net: '200.000đ' },
    { id: 'GRB-124582', date: '2023-10-26', total: '95.000đ', net: '76.000đ' },
    { id: 'GRB-124590', date: '2023-10-27', total: '180.000đ', net: '144.000đ' },
    { id: 'GRB-124591', date: '2023-10-27', total: '310.000đ', net: '248.000đ' },
    { id: 'GRB-124592', date: '2023-10-28', total: '150.000đ', net: '120.000đ' },
    { id: 'GRB-124593', date: '2023-10-28', total: '190.000đ', net: '152.000đ' },
];

const ReconciliationScreen: React.FC = () => {
    const [appPayout, setAppPayout] = useState(14985000);
    const systemTotal = 15000000;
    const difference = appPayout - systemTotal;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value).replace('₫', 'đ');
    };
    
    return (
        <div className="p-4 md:p-6 lg:p-8 w-full pb-28">
            <p className="text-slate-600 dark:text-slate-300 text-base font-normal leading-normal pb-6">Chọn loại đối soát và khoảng thời gian để xem danh sách giao dịch.</p>

            {/* Filters */}
            <div className="border rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <label className="flex flex-col w-full">
                        <p className="text-slate-800 dark:text-slate-200 text-base font-medium leading-normal pb-2">Loại đối soát</p>
                        <div className="relative">
                            <select className="form-select w-full appearance-none rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border border-slate-300 dark:border-slate-700 bg-background-light dark:bg-background-dark focus:border-primary-alt h-14 p-4 text-base">
                                <option>GrabFood</option>
                                <option>ShopeeFood</option>
                                <option>Baemin</option>
                                <option>Chuyển khoản ngân hàng</option>
                            </select>
                            <Icon name="expand_more" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </label>
                    <label className="flex flex-col w-full">
                        <p className="text-slate-800 dark:text-slate-200 text-base font-medium leading-normal pb-2">Chọn khoảng thời gian</p>
                        <div className="relative">
                            <input className="form-input w-full rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border border-slate-300 dark:border-slate-700 bg-background-light dark:bg-background-dark focus:border-primary-alt h-14 placeholder:text-slate-400 pl-12 pr-4 text-base" placeholder="Từ ngày - Đến ngày" />
                            <Icon name="calendar_today" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                    </label>
                    <button className="w-full md:w-auto min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-14 px-6 bg-primary-alt text-slate-900 text-base font-bold">Xem dữ liệu</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2 rounded-xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                            <p className="text-slate-600 dark:text-slate-300">Tổng doanh thu thuần (Hệ thống)</p>
                            <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold">{formatCurrency(systemTotal)}</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                            <p className="text-slate-600 dark:text-slate-300">Tổng số giao dịch</p>
                            <p className="text-slate-900 dark:text-white tracking-tight text-3xl font-bold">150</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6">
                        <h3 className="text-slate-900 dark:text-white text-lg font-bold pb-4">Khu vực Nhập liệu & Đối soát</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <label className="flex flex-col w-full">
                                <p className="text-slate-800 dark:text-slate-200 text-base font-medium leading-normal pb-2">Số tiền thực nhận</p>
                                <input type="number" className="form-input w-full rounded-lg text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 bg-background-light dark:bg-background-dark h-14 p-4" value={appPayout} onChange={e => setAppPayout(Number(e.target.value))} />
                            </label>
                            <div className="flex flex-col w-full">
                                <p className="text-slate-800 dark:text-slate-200 text-base font-medium leading-normal pb-2">Chênh lệch</p>
                                <div className={`flex items-center justify-center rounded-lg h-14 p-4 border ${difference === 0 ? 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800' : 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800'}`}>
                                    <p className={`text-lg font-bold ${difference === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(difference)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-slate-900 dark:text-white text-lg font-bold pb-2">Hành động</h3>
                        <p className="text-slate-600 dark:text-slate-300 text-sm pb-6">Kiểm tra kỹ thông tin trước khi xác nhận.</p>
                    </div>
                    <div className="space-y-3">
                        <button className="flex w-full items-center justify-center rounded-lg h-14 px-6 bg-primary-alt text-slate-900 text-base font-bold">
                            <Icon name="check_circle" className="mr-2" /> Xác nhận & Hạch toán
                        </button>
                        <button className="flex w-full items-center justify-center rounded-lg h-14 px-6 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-base font-bold">
                            <Icon name="download" className="mr-2" /> Xuất Excel
                        </button>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden mt-8">
                <h3 className="text-slate-900 dark:text-white text-lg font-bold px-6 pb-2 pt-6">Danh sách giao dịch chờ đối soát (150)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Mã giao dịch</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300">Ngày tạo</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-600 dark:text-slate-300 text-right">Doanh thu thuần</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {ordersData.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                                    <td className="px-6 py-4 text-sm text-slate-800 dark:text-slate-200 font-medium">{order.id}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{order.date}</td>
                                    <td className="px-6 py-4 text-sm text-slate-900 dark:text-white text-right font-mono font-semibold">{order.net}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-4">
                    <button className="flex items-center gap-2 rounded-lg h-10 px-4 bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-sm font-bold">
                        <Icon name="arrow_back" className="!text-base"/><span>Previous</span>
                    </button>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Page 1 of 10</span>
                    <button className="flex items-center gap-2 rounded-lg h-10 px-4 bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-sm font-bold">
                        <span>Next</span><Icon name="arrow_forward" className="!text-base"/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReconciliationScreen;
