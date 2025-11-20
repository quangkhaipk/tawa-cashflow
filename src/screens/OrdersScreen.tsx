import React, { useState } from 'react';
import { Icon } from '../components/Icon';

type OrderStatus = 'paid' | 'pending';

interface Order {
    id: string;
    platform: 'GrabFood' | 'ShopeeFood' | 'Baemin';
    netRevenue: string;
    status: OrderStatus;
    iconUrl: string;
}

const initialOrders: Order[] = [
    { id: 'GRB-123456', platform: 'GrabFood', netRevenue: '250.000đ', status: 'paid', iconUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCzzQDnQRBHaas6IiQFuLtlI-nspHxB6yAu0VwJ29EEliYbep1alY-o03H88GeH98BoDivALJNBqd9qK889z0v_L1tOAkuLJ00Ph_IXjZasQkN4sTG1uN1NKFh3YjGyge-8HRLVFgbsfXmGanFpcexeOVOK02Y8AR89eZlR8Pfl8WKJ44FZPg6Ty9ObGX_X5WYK6VQj9Ngf-fSgJLi5XwkV6GU6psUB8g3BbysUYS-z5uBeARRkx2vodnlo7AXHl72TLI3mjyQ3vTGt' },
    { id: 'SPF-789012', platform: 'ShopeeFood', netRevenue: '180.000đ', status: 'pending', iconUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAULxRTjDeNsYYC_ziomSSs2XmouRweF75a6C1gugLoaxAhz3RBzuAS0AkC46Xl1LJ98AGXQ-2IYUSGUKoGzBLhZNCWCAQ5_aD0SFviG2MeCBZN8AMrkwvM3IwVG-OHDu6SWzc7elktkOfvE7yHPE55eaoBHwxHTtIhYsMAsEib7xwM1392sQuKEG9aE50tGL30XCR-F1w9OSGnXDA3K6-dW7YHX79pbonXpgHPZffMQEC3w0Dk7HNigKRXYN7sXQHYXjV5cWsyNrSZ' },
    { id: 'BAE-345678', platform: 'Baemin', netRevenue: '320.000đ', status: 'paid', iconUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbd8-uFs6AesrMNVg6UT0bRyuyww8J4K52NEkUqeGi4isX88McI6pPQEjflhh8e9NI8bBRa7gEYp4CJZYegx2D4foEXc85FsoALZBSyYjNDVReC9LhF6gGAO-0ch1XRmk0AvZblW6plIeDEkBIdMR6vEmNkBOKN9qZEW_OKwQGnbhFWNolVJGyoahNJQ2GlZtqg0pMh-LdsIypwmlkuFYEnuydBy-vj4DQbPdj5cv94Nb_YHUkTps9qjP9OE8MyyTx5b4k3Uv51u85' },
];

const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
    const isPaid = status === 'paid';
    return (
        <div className={`flex items-center justify-center rounded-full ${isPaid ? 'bg-profit-bg dark:bg-profit/20' : 'bg-pending-bg dark:bg-pending/20'} px-3 py-1`}>
            <p className={`text-xs font-bold ${isPaid ? 'text-profit dark:text-profit-bg' : 'text-pending dark:text-amber-300'}`}>
                {isPaid ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'}
            </p>
        </div>
    );
};

const OrderCard: React.FC<{ order: Order }> = ({ order }) => (
    <div className="flex gap-4 bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
        <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[56px]" style={{ backgroundImage: `url("${order.iconUrl}")` }}></div>
        <div className="flex flex-1 flex-col justify-center gap-1">
            <p className="text-base font-bold leading-normal">{order.id}</p>
            <p className="text-sm font-medium leading-normal text-text-light-secondary dark:text-text-dark-secondary">
                Doanh thu ròng: <span className="font-bold text-text-light-primary dark:text-text-dark-primary">{order.netRevenue}</span>
            </p>
        </div>
        <div className="shrink-0 flex items-center">
            <OrderStatusBadge status={order.status} />
        </div>
    </div>
);


const OrdersScreen: React.FC = () => {
    const [orders] = useState<Order[]>(initialOrders);

    return (
        <div className="text-text-light-primary dark:text-text-dark-primary pb-28">
            {/* Date Picker */}
            <div className="px-4 py-3">
                <div className="flex items-center justify-between rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark p-3">
                    <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <Icon name="chevron_left" className="text-text-light-secondary dark:text-text-dark-secondary" />
                    </button>
                    <div className="text-center">
                        <p className="font-bold text-base">Hôm nay, 24/10/2023</p>
                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Thứ Ba</p>
                    </div>
                    <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                       <Icon name="chevron_right" className="text-text-light-secondary dark:text-text-dark-secondary" />
                    </button>
                </div>
            </div>

            {/* Stats Section */}
            <div className="flex flex-wrap gap-4 p-4 pt-0">
                <div className="flex min-w-[158px] flex-1 flex-col gap-1 rounded-lg p-4 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                    <p className="text-sm font-medium leading-normal text-text-light-secondary dark:text-text-dark-secondary">Tổng doanh thu</p>
                    <p className="tracking-tight text-2xl font-bold leading-tight">15.2M</p>
                </div>
                <div className="flex min-w-[158px] flex-1 flex-col gap-1 rounded-lg p-4 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                    <p className="text-sm font-medium leading-normal text-text-light-secondary dark:text-text-dark-secondary">Tổng số đơn</p>
                    <p className="tracking-tight text-2xl font-bold leading-tight">75</p>
                </div>
            </div>

            {/* Order List */}
            <div className="flex flex-col gap-3 px-4 pb-6">
                {orders.length > 0 ? (
                    orders.map(order => <OrderCard key={order.id} order={order} />)
                ) : (
                    <div className="flex flex-col items-center justify-center text-center gap-4 p-10 mt-8 rounded-lg bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark">
                        <Icon name="receipt_long" className="!text-5xl text-text-light-secondary dark:text-text-dark-secondary" />
                        <p className="font-bold">Chưa có đơn hàng nào</p>
                        <p className="text-sm text-text-light-secondary dark:text-text-dark-secondary">Chưa có đơn hàng nào trong ngày hôm nay.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrdersScreen;
