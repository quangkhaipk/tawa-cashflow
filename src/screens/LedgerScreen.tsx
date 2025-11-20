import React, { useState, useMemo, useEffect, FC } from 'react';
import { supabase } from '../supabaseClient'

// Re-added Icon component definition locally since its file might be removed.
const Icon: FC<{ name: string; className?: string; }> = ({ name, className }) => (
    <span className={`material-symbols-outlined ${className || ''}`}>{name}</span>
);

type TransactionType = 'income' | 'expense' | 'transfer';
type DateFilter = 'today' | 'week' | 'month';
type TypeFilter = 'all' | 'income' | 'expense' | 'transfer';

const incomeCategories = [
    { name: 'GrabFood', icon: 'storefront' },
    { name: 'ShopeeFood', icon: 'shopping_bag' },
    { name: 'Be', icon: 'local_shipping' },
    { name: 'Xanh Ngon', icon: 'eco' },
    { name: 'Chuyển khoản', icon: 'account_balance' },
];
const expenseCategories = [
    { name: 'Mua nguyên liệu', icon: 'restaurant' },
    { name: 'Lương', icon: 'payments' },
    { name: 'Điện', icon: 'electric_bolt' },
    { name: 'Nước', icon: 'water_drop' },
    { name: 'Net', icon: 'wifi' },
    { name: 'Mua bao bì/tiêu hao', icon: 'inventory_2' },
    { name: 'Vật tư cửa hàng', icon: 'store' },
    { name: 'Marketing', icon: 'campaign'}
];
const wallets = ['Techcombank', 'Ví Tiền mặt'];

interface Transaction {
    id: number;
    type: TransactionType;
    category?: string;
    wallet?: string;
    fromWallet?: string;
    toWallet?: string;
    amount: number;
    note?: string;
    createdAt: Date;
    updatedAt?: Date;
}


interface ActivityLogEntry {
    id: number;
    timestamp: Date;
    message: string;
}

const formatCurrency = (value: number, showSign = false) => {
    const sign = value > 0 && showSign ? '+' : '';
    const formattedValue = new Intl.NumberFormat('vi-VN').format(Math.abs(value));
    return `${value < 0 ? '-' : sign}${formattedValue}đ`;
};

const formatAmountInput = (value: string): string => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    return new Intl.NumberFormat('vi-VN').format(Number(numericValue));
};
const parseFormattedAmount = (formattedValue: string): number => {
    return Number(formattedValue.replace(/[^0-9]/g, ''));
};

const CategoryPicker: React.FC<{
    categories: {name: string, icon: string}[];
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    type: 'income' | 'expense';
}> = ({ categories, selectedCategory, onSelectCategory, type }) => {
    const color = type === 'income' ? 'text-profit' : 'text-loss';
    const bgColor = type === 'income' ? 'bg-profit-bg dark:bg-profit/20' : 'bg-loss-bg dark:bg-loss/20';
    
    return (
        <div className="grid grid-cols-4 gap-3 text-center">
            {categories.map(({name, icon}) => (
                <div key={name} onClick={() => onSelectCategory(name)} className="flex flex-col items-center gap-2 cursor-pointer">
                    <div className={`flex items-center justify-center size-14 rounded-2xl transition-colors ${selectedCategory === name ? `${bgColor} ${color}` : 'bg-zinc-200/60 dark:bg-zinc-800/60 text-text-light-secondary dark:text-text-dark-secondary'}`}>
                        <Icon name={icon} />
                    </div>
                    <p className={`text-xs font-medium ${selectedCategory === name ? 'text-text-light-primary dark:text-text-dark-primary' : 'text-text-light-secondary dark:text-text-dark-secondary'}`}>{name}</p>
                </div>
            ))}
        </div>
    )
}


const AddEditTransactionModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>, id?: number) => void;
    transactionToEdit: Transaction | null;
}> = ({ isOpen, onClose, onSave, transactionToEdit }) => {
    const [type, setType] = useState<TransactionType>('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState(expenseCategories[0].name);
    const [wallet, setWallet] = useState(wallets[0]);
    const [fromWallet, setFromWallet] = useState(wallets[0]);
    const [toWallet, setToWallet] = useState(wallets[1]);
    const [note, setNote] = useState('');
    
    useEffect(() => {
        if (transactionToEdit) {
            setType(transactionToEdit.type);
            const absAmount = Math.abs(transactionToEdit.amount);
            setAmount(formatAmountInput(String(absAmount)));
            setNote(transactionToEdit.note || '');
            if (transactionToEdit.type === 'transfer') {
                setFromWallet(transactionToEdit.fromWallet || wallets[0]);
                setToWallet(transactionToEdit.toWallet || wallets[1]);
            } else {
                setCategory(transactionToEdit.category || (transactionToEdit.type === 'income' ? incomeCategories[0].name : expenseCategories[0].name));
                setWallet(transactionToEdit.wallet || wallets[0]);
            }
        } else {
            // Reset form for new transaction
            setType('expense');
            setAmount('');
            setCategory(expenseCategories[0].name);
            setWallet(wallets[0]);
            setFromWallet(wallets[0]);
            setToWallet(wallets[1]);
            setNote('');
        }
    }, [transactionToEdit, isOpen]);
    
    useEffect(() => {
        if (!transactionToEdit) {
            if (type === 'income') setCategory(incomeCategories[0].name);
            if (type === 'expense') setCategory(expenseCategories[0].name);
        }
    }, [type, transactionToEdit]);

    if (!isOpen) return null;

    const handleSave = () => {
        const numericAmount = parseFormattedAmount(amount);
        if (numericAmount <= 0) {
            alert("Vui lòng nhập số tiền hợp lệ.");
            return;
        }

        if (type === 'transfer' && fromWallet === toWallet) {
            alert("Ví nguồn và ví đích không được trùng nhau.");
            return;
        }
        
        let txData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;

        if (type === 'transfer') {
            txData = { type, fromWallet, toWallet, amount: numericAmount, note };
        } else {
            txData = { type, category, wallet, amount: type === 'income' ? numericAmount : -numericAmount, note };
        }

        onSave(txData, transactionToEdit?.id);
        onClose();
    };
    
    const amountColor = type === 'income' ? 'text-profit' : type === 'expense' ? 'text-loss' : 'text-blue-500';

    return (
        <div className="fixed inset-0 bg-background-light dark:bg-background-dark z-50 flex flex-col max-w-lg mx-auto">
            <header className="flex items-center justify-between p-4 pb-2">
                <button onClick={onClose} className="flex size-12 items-center justify-center">
                    <Icon name="close" className="text-stone-900 dark:text-stone-100" />
                </button>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{transactionToEdit ? 'Sửa Giao dịch' : 'Thêm Giao dịch'}</h2>
                <div className="w-12"></div>
            </header>
            <div className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto">
                <div className="flex h-12 items-center justify-center rounded-lg bg-zinc-200/60 p-1 dark:bg-zinc-800/60">
                    <button onClick={() => setType('expense')} className={`flex-1 h-full rounded-md text-base font-bold transition-colors ${type === 'expense' ? 'bg-surface-light dark:bg-surface-dark shadow-sm text-loss' : 'text-text-light-secondary dark:text-text-dark-secondary'}`}>
                        Chi tiền
                    </button>
                    <button onClick={() => setType('income')} className={`flex-1 h-full rounded-md text-base font-bold transition-colors ${type === 'income' ? 'bg-surface-light dark:bg-surface-dark shadow-sm text-profit' : 'text-text-light-secondary dark:text-text-dark-secondary'}`}>
                        Thu tiền
                    </button>
                     <button onClick={() => setType('transfer')} className={`flex-1 h-full rounded-md text-base font-bold transition-colors ${type === 'transfer' ? 'bg-surface-light dark:bg-surface-dark shadow-sm text-blue-500' : 'text-text-light-secondary dark:text-text-dark-secondary'}`}>
                        Chuyển tiền
                    </button>
                </div>
                
                <div className="flex flex-col items-center gap-2">
                    <label className="text-lg font-medium text-text-light-secondary dark:text-text-dark-secondary">Số tiền</label>
                    <div className="flex items-baseline justify-center">
                        <span className={`text-4xl font-bold ${amountColor}`}>đ</span>
                        <input
                            value={amount}
                            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                            placeholder="0"
                            className={`form-input bg-transparent border-none text-center text-5xl font-bold p-0 focus:ring-0 w-auto max-w-full ml-1 ${amountColor}`}
                        />
                    </div>
                </div>

                <div className="space-y-4">
                     {type === 'transfer' ? (
                        <>
                           <div className="flex items-center gap-4">
                                <Icon name="move_up" className="text-text-light-secondary dark:text-text-dark-secondary" />
                                <select value={fromWallet} onChange={(e) => setFromWallet(e.target.value)} className="form-select w-full bg-transparent border-0 border-b border-border-light dark:border-border-dark focus:ring-0 focus:border-primary-alt">
                                    {wallets.map(w => (<option key={`from-${w}`} value={w}>Từ {w}</option>))}
                                </select>
                            </div>
                           <div className="flex items-center gap-4">
                                <Icon name="move_down" className="text-text-light-secondary dark:text-text-dark-secondary" />
                                <select value={toWallet} onChange={(e) => setToWallet(e.target.value)} className="form-select w-full bg-transparent border-0 border-b border-border-light dark:border-border-dark focus:ring-0 focus:border-primary-alt">
                                    {wallets.map(w => (<option key={`to-${w}`} value={w}>Đến {w}</option>))}
                                </select>
                            </div>
                        </>
                    ) : (
                         <>
                             <div className="space-y-3">
                                <p className="font-bold text-text-light-primary dark:text-text-dark-primary">Chọn hạng mục</p>
                                <CategoryPicker 
                                    categories={type === 'income' ? incomeCategories : expenseCategories}
                                    selectedCategory={category}
                                    onSelectCategory={setCategory}
                                    type={type}
                                />
                             </div>
                             <div className="flex items-center gap-4 pt-4">
                                <Icon name="account_balance_wallet" className="text-text-light-secondary dark:text-text-dark-secondary" />
                                <select value={wallet} onChange={(e) => setWallet(e.target.value)} className="form-select w-full bg-transparent border-0 border-b border-border-light dark:border-border-dark focus:ring-0 focus:border-primary-alt">
                                    {wallets.map(w => (<option key={w}>{w}</option>))}
                                </select>
                            </div>
                         </>
                    )}
                    <div className="flex items-center gap-4">
                        <Icon name="description" className="text-text-light-secondary dark:text-text-dark-secondary" />
                        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (không bắt buộc)" className="form-input w-full bg-transparent border-0 border-b border-border-light dark:border-border-dark focus:ring-0 focus:border-primary-alt" />
                    </div>
                </div>
            </div>
            <div className="p-4 mt-auto">
                <button onClick={handleSave} className="w-full h-14 rounded-xl bg-primary-alt text-background-dark text-lg font-bold">Lưu</button>
            </div>
        </div>
    );
};


const ActionSheet: FC<{
    isOpen: boolean;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ isOpen, onClose, onEdit, onDelete }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/40 z-40 max-w-lg mx-auto" onClick={onClose}>
            <div className="absolute bottom-0 w-full bg-surface-light dark:bg-surface-dark rounded-t-xl p-4 flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={onEdit} className="w-full h-12 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80 text-text-light-primary dark:text-text-dark-primary font-bold">Sửa</button>
                <button onClick={onDelete} className="w-full h-12 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80 text-loss font-bold">Xoá</button>
                <button onClick={onClose} className="w-full h-12 rounded-lg mt-2 font-bold text-primary-alt">Huỷ</button>
            </div>
        </div>
    );
};

const DeleteConfirmModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center max-w-lg mx-auto" onClick={onClose}>
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 m-4 w-full" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg text-text-light-primary dark:text-text-dark-primary">Xác nhận xoá?</h3>
                <p className="text-text-light-secondary dark:text-text-dark-secondary mt-2">Hành động này không thể hoàn tác.</p>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 h-11 rounded-lg bg-zinc-200/80 dark:bg-zinc-800/80 font-bold">Huỷ</button>
                    <button onClick={onConfirm} className="flex-1 h-11 rounded-lg bg-loss text-white font-bold">Xoá</button>
                </div>
            </div>
        </div>
    )
}

const ActivityLogModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    logs: ActivityLogEntry[];
}> = ({ isOpen, onClose, logs }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-background-light dark:bg-background-dark z-50 flex flex-col max-w-lg mx-auto">
            <header className="flex items-center justify-between p-4 pb-2 sticky top-0 bg-background-light/[.85] backdrop-blur-sm dark:bg-background-dark/[.85]">
                 <div className="w-12"></div>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Lịch sử hoạt động</h2>
                 <button onClick={onClose} className="flex size-12 items-center justify-center">
                    <Icon name="close" className="text-stone-900 dark:text-stone-100" />
                </button>
            </header>
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                {logs.length === 0 ? (
                    <p className="text-center text-text-light-secondary dark:text-text-dark-secondary py-10">Chưa có hoạt động nào.</p>
                ) : (
                    [...logs].sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()).map(log => (
                        <div key={log.id} className="flex gap-3">
                            <Icon name="history" className="text-text-light-secondary dark:text-text-dark-secondary mt-1"/>
                            <div className="flex-1">
                                <p className="text-text-light-primary dark:text-text-dark-primary">{log.message}</p>
                                <p className="text-xs text-text-light-secondary dark:text-text-dark-secondary">{log.timestamp.toLocaleString('vi-VN')}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const OpeningBalanceModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (balances: Record<string, number>) => void;
    currentBalances: Record<string, number>;
}> = ({ isOpen, onClose, onSave, currentBalances }) => {
    const [balances, setBalances] = useState(currentBalances);

    useEffect(() => {
        if (isOpen) {
            setBalances(currentBalances);
        }
    }, [isOpen, currentBalances]);

    if (!isOpen) return null;

    const handleAmountChange = (wallet: string, value: string) => {
        const numericValue = parseFormattedAmount(value);
        setBalances(prev => ({...prev, [wallet]: numericValue }));
    };

    const handleSave = () => {
        onSave(balances);
    };

    return (
        <div className="fixed inset-0 bg-background-light dark:bg-background-dark z-50 flex flex-col max-w-lg mx-auto">
             <header className="flex items-center justify-between p-4 pb-2">
                <button onClick={onClose} className="flex size-12 items-center justify-center">
                    <Icon name="close" className="text-stone-900 dark:text-stone-100" />
                </button>
                <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">Cài đặt Tồn Quỹ Đầu Kỳ</h2>
                <div className="w-12"></div>
            </header>
            <div className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto">
                <p className="text-center text-text-light-secondary dark:text-text-dark-secondary">Nhập số dư ban đầu cho mỗi ví. Số dư hiện tại sẽ được tính dựa trên số này.</p>
                <div className="space-y-4">
                    {wallets.map(wallet => (
                        <div key={wallet}>
                            <label className="font-bold text-text-light-primary dark:text-text-dark-primary">{wallet}</label>
                            <input
                                type="text"
                                value={formatAmountInput(String(balances[wallet] || 0))}
                                onChange={(e) => handleAmountChange(wallet, e.target.value)}
                                className="form-input w-full h-14 mt-2 rounded-xl border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-lg"
                                placeholder="0"
                            />
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-4 mt-auto">
                <button onClick={handleSave} className="w-full h-14 rounded-xl bg-primary-alt text-background-dark text-lg font-bold">Lưu thay đổi</button>
            </div>
        </div>
    );
};


const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

const initialTransactions: Transaction[] = [
    { id: 1, type: 'income', category: 'GrabFood', wallet: 'Ví Tiền mặt', amount: 1500000, createdAt: today, note: 'Doanh thu ca sáng' },
    { id: 2, type: 'expense', category: 'Mua nguyên liệu', wallet: 'Ví Tiền mặt', amount: -850000, createdAt: today },
    { id: 6, type: 'transfer', fromWallet: 'Ví Tiền mặt', toWallet: 'Techcombank', amount: 500000, createdAt: today, note: 'Nộp tiền vào NH' },
    { id: 3, type: 'expense', category: 'Lương', wallet: 'Techcombank', amount: -5000000, createdAt: today },
    { id: 4, type: 'income', category: 'ShopeeFood', wallet: 'Ví Tiền mặt', amount: 2750000, createdAt: yesterday },
    { id: 5, type: 'expense', category: 'Điện', wallet: 'Techcombank', amount: -1200000, createdAt: yesterday },
];

const LedgerScreen: React.FC = () => {
    // State Management
    const [transactions, setTransactions] = useState<Transaction[]>([]);
const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
    const [openingBalances, setOpeningBalances] = useState<Record<string, number>>(
        wallets.reduce((acc, w) => ({...acc, [w]: 0}), {})
    );
      // Lấy dữ liệu từ Supabase khi mở app
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Lỗi tải dữ liệu Supabase:', error);
          alert('Không tải được dữ liệu sổ quỹ. Kiểm tra lại Supabase.');
          return;
        }

        if (data) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            type: row.type,
            category: row.category || undefined,
            wallet: row.wallet || undefined,
            fromWallet: row.from_wallet || undefined,
            toWallet: row.to_wallet || undefined,
            amount: row.amount,
            note: row.note || undefined,
            createdAt: new Date(row.created_at),
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
          })) as Transaction[];

          setTransactions(mapped);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [isLogOpen, setIsLogOpen] = useState(false);
    const [isOpeningBalanceOpen, setIsOpeningBalanceOpen] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState<DateFilter>('today');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    
    // Handlers
    const addLog = (message: string) => {
        setActivityLog(prev => [{ id: Date.now(), timestamp: new Date(), message }, ...prev]);
    };

    const handleSaveTransaction = async (
  transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
  id?: number
) => {
  // Nếu đang sửa giao dịch cũ
  if (id) {
    const { error } = await supabase
      .from('transactions')
      .update({
        type: transactionData.type,
        category: transactionData.category ?? null,
        wallet: transactionData.wallet ?? null,
        from_wallet: transactionData.fromWallet ?? null,
        to_wallet: transactionData.toWallet ?? null,
        amount: transactionData.amount,
        note: transactionData.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Lỗi sửa giao dịch:', error);
      alert('Lỗi khi sửa giao dịch');
      return;
    }

    setTransactions(prev =>
      prev.map(t =>
        t.id === id ? { ...t, ...transactionData, updatedAt: new Date() } : t
      )
    );

    addLog(`Đã sửa giao dịch #${id}.`);
  } else {
    // Thêm giao dịch mới
    const { data, error } = await supabase
      .from('transactions')
      .insert([
        {
          type: transactionData.type,
          category: transactionData.category ?? null,
          wallet: transactionData.wallet ?? null,
          from_wallet: transactionData.fromWallet ?? null,
          to_wallet: transactionData.toWallet ?? null,
          amount: transactionData.amount,
          note: transactionData.note ?? null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Lỗi thêm giao dịch:', error);
      alert('Lỗi khi thêm giao dịch');
      return;
    }

    const newTx: Transaction = {
      id: data.id,
      type: data.type,
      category: data.category || undefined,
      wallet: data.wallet || undefined,
      fromWallet: data.from_wallet || undefined,
      toWallet: data.to_wallet || undefined,
      amount: data.amount,
      note: data.note || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    };

    setTransactions(prev => [newTx, ...prev]);
    addLog(`Đã thêm giao dịch mới: ${formatCurrency(newTx.amount)}.`);
  }

  setEditingTransaction(null);
  setIsModalOpen(false);
};

    
      const handleDeleteTransaction = async () => {
    if (!selectedTransaction) return;

    const id = selectedTransaction.id;

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Lỗi xoá giao dịch:', error);
      alert('Lỗi khi xoá giao dịch');
      return;
    }

    if (selectedTransaction.type === 'transfer') {
      addLog(
        `Đã xoá giao dịch chuyển tiền: ${formatCurrency(
          selectedTransaction.amount
        )} từ ${selectedTransaction.fromWallet} đến ${selectedTransaction.toWallet}`
      );
    } else {
      addLog(
        `Đã xoá giao dịch: ${selectedTransaction.category} (${formatCurrency(
          selectedTransaction.amount
        )})`
      );
    }

    setTransactions(prev => prev.filter(t => t.id !== id));
    setIsDeleteConfirmOpen(false);
    setSelectedTransaction(null);
  };


    const handleOpenActionSheet = (tx: Transaction) => {
        setSelectedTransaction(tx);
        setIsActionSheetOpen(true);
    };

    const handleEdit = () => {
        setEditingTransaction(selectedTransaction);
        setIsModalOpen(true);
        setIsActionSheetOpen(false);
    };

    const handleDelete = () => {
        setIsDeleteConfirmOpen(true);
        setIsActionSheetOpen(false);
    };
    
    const handleSaveOpeningBalances = (balances: Record<string, number>) => {
        wallets.forEach(wallet => {
            if(openingBalances[wallet] !== balances[wallet]) {
                addLog(`Tồn đầu kỳ "${wallet}" đã thay đổi từ ${formatCurrency(openingBalances[wallet] || 0)} thành ${formatCurrency(balances[wallet] || 0)}.`);
            }
        });
        setOpeningBalances(balances);
        setIsOpeningBalanceOpen(false);
    };

    // Memoized Calculations
    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)); 
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return transactions.filter(tx => {
             const lowercasedFilter = searchTerm.toLowerCase();
            const searchMatch = !lowercasedFilter ||
                tx.category?.toLowerCase().includes(lowercasedFilter) ||
                tx.note?.toLowerCase().includes(lowercasedFilter);
                
            const txDate = tx.createdAt;
            let dateMatch = false;
            if (dateFilter === 'today') dateMatch = txDate >= startOfDay;
            else if (dateFilter === 'week') dateMatch = txDate >= startOfWeek;
            else if (dateFilter === 'month') dateMatch = txDate >= startOfMonth;
            
            const typeMatch = typeFilter === 'all' || tx.type === typeFilter;

            return searchMatch && dateMatch && typeMatch;
        });
    }, [transactions, dateFilter, typeFilter, searchTerm]);
    
    const groupedTransactions = useMemo(() => {
        return filteredTransactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
            const dateKey = tx.createdAt.toDateString();
            if (!acc[dateKey]) acc[dateKey] = [];
            acc[dateKey].push(tx);
            return acc;
        }, {});
    }, [filteredTransactions]);
    
    const { balances, totalBalance, totalIncome, totalExpense } = useMemo(() => {
        const balances: Record<string, number> = wallets.reduce((acc: Record<string, number>, w) => ({
            ...acc, [w]: openingBalances[w] || 0
        }), {});

        transactions.forEach(tx => {
            if (tx.type === 'transfer') {
                if(tx.fromWallet && balances[tx.fromWallet] !== undefined) balances[tx.fromWallet] -= tx.amount;
                if(tx.toWallet && balances[tx.toWallet] !== undefined) balances[tx.toWallet] += tx.amount;
            } else {
                if (tx.wallet && balances[tx.wallet] !== undefined) {
                    balances[tx.wallet] += tx.amount;
                }
            }
        });
        
        const totalBalance = Object.values(balances).reduce((sum, b) => sum + b, 0);
        
        const { income, expense } = filteredTransactions.reduce((acc, tx) => {
            if(tx.type === 'income') acc.income += tx.amount;
            else if(tx.type === 'expense') acc.expense += tx.amount;
            return acc;
        }, {income: 0, expense: 0});

        return { balances, totalBalance, totalIncome: income, totalExpense: expense };
    }, [transactions, filteredTransactions, openingBalances]);


    return (
        <div className="flex flex-col h-full bg-background-light dark:bg-background-dark pb-24">
            <header className="sticky top-0 z-10 flex items-center justify-between bg-background-light/[.85] p-4 pb-2 backdrop-blur-sm dark:bg-background-dark/[.85]">
                <div className="flex size-12 shrink-0 items-center justify-start">
                     <button onClick={() => setIsOpeningBalanceOpen(true)}><Icon name="settings" /></button>
                </div>
                <h2 className="flex-1 text-lg font-bold leading-tight tracking-[-0.015em] text-stone-900 dark:text-stone-100 text-center">Sổ Quỹ TAWA - QUẬN 1</h2>
                <div className="flex w-12 items-center justify-end">
                    <button onClick={() => setIsLogOpen(true)}><Icon name="history" /></button>
                </div>
            </header>
            
            <main className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-4">
                     <div className="rounded-xl bg-primary/20 p-4 text-center">
                        <p className="text-sm font-medium text-primary/80">Tổng Tồn Quỹ</p>
                        <p className="text-3xl font-bold text-primary">{formatCurrency(totalBalance)}</p>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                        {Object.entries(balances).map(([wallet, balance]) => {
                            const isCash = wallet === 'Ví Tiền mặt';
                            const cardClasses = isCash
                                ? 'bg-green-100/60 dark:bg-green-900/30 border-green-200 dark:border-green-800'
                                : 'bg-blue-100/60 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800';
                            const walletTextClasses = isCash
                                ? 'text-green-900/80 dark:text-green-300/80'
                                : 'text-blue-900/80 dark:text-blue-300/80';
                            const balanceTextClasses = isCash
                                ? 'text-green-900 dark:text-green-200'
                                : 'text-blue-900 dark:text-blue-200';

                            return (
                                <div key={wallet} className={`rounded-lg p-3 border ${cardClasses}`}>
                                    <p className={`text-sm font-medium ${walletTextClasses}`}>{wallet}</p>
                                    <p className={`text-xl font-bold ${balanceTextClasses}`}>{formatCurrency(balance as number)}</p>
                                </div>
                            );
                        })}
                    </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-profit-bg dark:bg-profit/20 p-3">
                            <p className="text-sm text-profit dark:text-profit-bg/80">Thu trong ngày</p>
                            <p className="font-bold text-profit dark:text-profit-bg">{formatCurrency(totalIncome, true)}</p>
                        </div>
                         <div className="rounded-lg bg-loss-bg dark:bg-loss/20 p-3">
                            <p className="text-sm text-loss dark:text-loss-bg/80">Chi trong ngày</p>
                            <p className="font-bold text-loss dark:text-loss-bg">{formatCurrency(totalExpense)}</p>
                        </div>
                    </div>
                </div>

                <div className="px-4 py-2 flex flex-col gap-3">
                    <div className="flex gap-2">
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="form-input flex-1 rounded-lg border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark" 
                            placeholder="Tìm theo hạng mục, ghi chú..." />
                    </div>
                    <div className="flex gap-2">
                         <select onChange={(e) => setDateFilter(e.target.value as DateFilter)} value={dateFilter} className="form-select flex-1 rounded-lg border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                            <option value="today">Hôm nay</option>
                            <option value="week">Tuần này</option>
                            <option value="month">Tháng này</option>
                        </select>
                         <select onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} value={typeFilter} className="form-select flex-1 rounded-lg border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark">
                            <option value="all">Tất cả</option>
                            <option value="income">Thu</option>
                            <option value="expense">Chi</option>
                            <option value="transfer">Chuyển tiền</option>
                        </select>
                    </div>
                </div>
                
                <div className="flex flex-col gap-2">
                    {Object.entries(groupedTransactions).length === 0 ? (
                        <p className="text-center text-text-light-secondary dark:text-text-dark-secondary py-10">Không có giao dịch nào.</p>
                    ) : (
                    Object.entries(groupedTransactions).sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime()).map(([date, txs]) => (
                        <div key={date}>
                             <h4 className="px-4 py-2 text-sm font-bold leading-normal tracking-[0.015em] text-primary-alt dark:text-primary-alt">
                                {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h4>
                            {[...(txs as Transaction[])].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()).map((tx) => {
                                const isIncome = tx.type === 'income';
                                const isExpense = tx.type === 'expense';
                                const isTransfer = tx.type === 'transfer';
                                
                                const iconName = isIncome ? 'south_west' : isExpense ? 'north_east' : 'swap_horiz';
                                const colorClasses = isIncome ? 'bg-green-500/20 text-green-500' : isExpense ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500';
                                const amountColor = isIncome ? 'text-green-500' : isExpense ? 'text-red-500' : 'text-blue-500';

                                return (
                                <div key={tx.id} onClick={() => handleOpenActionSheet(tx)} className="flex min-h-[72px] cursor-pointer items-start gap-4 bg-background-light px-4 py-3 justify-between hover:bg-stone-200/50 dark:bg-background-dark dark:hover:bg-stone-800/50">
                                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                        <div className={`flex size-12 shrink-0 items-center justify-center rounded-lg ${colorClasses}`}>
                                            <Icon name={iconName} />
                                        </div>
                                        <div className="flex flex-col justify-center overflow-hidden">
                                            <p className="font-medium line-clamp-1 text-stone-900 dark:text-stone-100">{isTransfer ? 'Chuyển tiền' : tx.category}</p>
                                            <p className="text-sm line-clamp-2 text-stone-600 dark:text-stone-400">{isTransfer ? `Từ ${tx.fromWallet} → ${tx.toWallet}` : tx.wallet}</p>
                                            {tx.note && <p className="text-xs italic line-clamp-2 text-stone-500 dark:text-stone-500 pt-1 truncate">"{tx.note}"</p>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <p className={`font-normal ${amountColor}`}>{formatCurrency(tx.amount)}</p>
                                        <p className="text-xs text-stone-500 dark:text-stone-400">{tx.createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                        {tx.updatedAt && <p className="text-xs italic text-stone-500 dark:text-stone-500">Đã sửa</p>}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )))}
                </div>
            </main>

            <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="fixed bottom-6 right-1/2 translate-x-1/2 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-primary-alt text-black shadow-lg hover:bg-primary-alt/90 dark:text-stone-900">
                <Icon name="add" className="!text-3xl" />
            </button>
            
            <AddEditTransactionModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTransaction} transactionToEdit={editingTransaction} />
            <ActionSheet isOpen={isActionSheetOpen} onClose={() => setIsActionSheetOpen(false)} onEdit={handleEdit} onDelete={handleDelete} />
            <DeleteConfirmModal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDeleteTransaction} />
            <ActivityLogModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} logs={activityLog}/>
            <OpeningBalanceModal isOpen={isOpeningBalanceOpen} onClose={() => setIsOpeningBalanceOpen(false)} onSave={handleSaveOpeningBalances} currentBalances={openingBalances} />
        </div>
    );
};

export default LedgerScreen;