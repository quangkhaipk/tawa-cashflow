import React, {
  useState,
  useMemo,
  useEffect,
  FC,
} from 'react';
import { Icon } from '../components/Icon';
import { supabase } from '../supabaseClient';

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
  { name: 'Marketing', icon: 'campaign' },
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
  const formattedValue = new Intl.NumberFormat('vi-VN').format(
    Math.abs(value)
  );
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

const CategoryPicker: FC<{
  categories: { name: string; icon: string }[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  type: 'income' | 'expense';
}> = ({ categories, selectedCategory, onSelectCategory, type }) => {
  const color =
    type === 'income' ? 'text-emerald-600' : 'text-rose-600';
  const bgColor =
    type === 'income'
      ? 'bg-emerald-50'
      : 'bg-rose-50';

  return (
    <div className="grid grid-cols-4 gap-3 text-center">
      {categories.map(({ name, icon }) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelectCategory(name)}
          className="flex flex-col items-center gap-2 cursor-pointer focus:outline-none"
        >
          <div
            className={`flex items-center justify-center h-14 w-14 rounded-2xl text-lg transition-colors ${
              selectedCategory === name
                ? `${bgColor} ${color} shadow-sm`
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300'
            }`}
          >
            <Icon name={icon} />
          </div>
          <p
            className={`text-xs font-medium ${
              selectedCategory === name
                ? 'text-zinc-900 dark:text-zinc-50'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {name}
          </p>
        </button>
      ))}
    </div>
  );
};

const AddEditTransactionModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
    id?: number
  ) => void;
  transactionToEdit: Transaction | null;
}> = ({ isOpen, onClose, onSave, transactionToEdit }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(
    expenseCategories[0].name
  );
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
        setCategory(
          transactionToEdit.category ||
            (transactionToEdit.type === 'income'
              ? incomeCategories[0].name
              : expenseCategories[0].name)
        );
        setWallet(transactionToEdit.wallet || wallets[0]);
      }
    } else {
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
      if (type === 'income')
        setCategory(incomeCategories[0].name);
      if (type === 'expense')
        setCategory(expenseCategories[0].name);
    }
  }, [type, transactionToEdit]);

  if (!isOpen) return null;

  const handleSave = () => {
    const numericAmount = parseFormattedAmount(amount);
    if (numericAmount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ.');
      return;
    }

    if (type === 'transfer' && fromWallet === toWallet) {
      alert('Ví nguồn và ví đích không được trùng nhau.');
      return;
    }

    let txData: Omit<
      Transaction,
      'id' | 'createdAt' | 'updatedAt'
    >;

    if (type === 'transfer') {
      txData = {
        type,
        fromWallet,
        toWallet,
        amount: numericAmount,
        note,
      };
    } else {
      txData = {
        type,
        category,
        wallet,
        amount:
          type === 'income'
            ? numericAmount
            : -numericAmount,
        note,
      };
    }

    onSave(txData, transactionToEdit?.id);
  };

  const amountColor =
    type === 'income'
      ? 'text-emerald-600'
      : type === 'expense'
      ? 'text-rose-600'
      : 'text-sky-600';

  return (
    <div className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto bg-zinc-50 dark:bg-zinc-900">
      <header className="flex items-center justify-between px-4 pt-3 pb-1">
        <button
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
        >
          <Icon
            name="close"
            className="text-zinc-800 dark:text-zinc-100"
          />
        </button>
        <h2 className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-50">
          {transactionToEdit ? 'Sửa giao dịch' : 'Thêm giao dịch'}
        </h2>
        <div className="w-11" />
      </header>

      <div className="px-4 pb-3">
        <div className="flex h-10 items-center justify-center rounded-full bg-zinc-200/70 dark:bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 h-full rounded-full text-xs font-semibold tracking-wide ${
              type === 'expense'
                ? 'bg-white dark:bg-zinc-900 shadow text-rose-600'
                : 'text-zinc-500'
            }`}
          >
            Chi tiền
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 h-full rounded-full text-xs font-semibold tracking-wide ${
              type === 'income'
                ? 'bg-white dark:bg-zinc-900 shadow text-emerald-600'
                : 'text-zinc-500'
            }`}
          >
            Thu tiền
          </button>
          <button
            type="button"
            onClick={() => setType('transfer')}
            className={`flex-1 h-full rounded-full text-xs font-semibold tracking-wide ${
              type === 'transfer'
                ? 'bg-white dark:bg-zinc-900 shadow text-sky-600'
                : 'text-zinc-500'
            }`}
          >
            Chuyển tiền
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pb-4 space-y-6 overflow-y-auto">
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="text-xs font-medium text-zinc-500">
            SỐ TIỀN
          </span>
          <div className="flex items-baseline justify-center gap-1">
            <span
              className={`text-4xl font-extrabold ${amountColor}`}
            >
              đ
            </span>
            <input
              value={amount}
              onChange={(e) =>
                setAmount(formatAmountInput(e.target.value))
              }
              placeholder="0"
              className={`bg-transparent border-none text-center text-4xl font-extrabold tracking-tight focus:ring-0 focus:outline-none w-auto max-w-full ${amountColor}`}
            />
          </div>
        </div>

        <div className="space-y-4">
          {type === 'transfer' ? (
            <>
              <div className="flex items-center gap-3">
                <Icon
                  name="move_up"
                  className="text-zinc-500"
                />
                <select
                  value={fromWallet}
                  onChange={(e) =>
                    setFromWallet(e.target.value)
                  }
                  className="form-select w-full border-0 border-b border-zinc-200 dark:border-zinc-700 bg-transparent rounded-none px-0 text-sm focus:ring-0 focus:border-amber-500"
                >
                  {wallets.map((w) => (
                    <option key={`from-${w}`} value={w}>
                      Từ {w}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <Icon
                  name="move_down"
                  className="text-zinc-500"
                />
                <select
                  value={toWallet}
                  onChange={(e) => setToWallet(e.target.value)}
                  className="form-select w-full border-0 border-b border-zinc-200 dark:border-zinc-700 bg-transparent rounded-none px-0 text-sm focus:ring-0 focus:border-amber-500"
                >
                  {wallets.map((w) => (
                    <option key={`to-${w}`} value={w}>
                      Đến {w}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-zinc-600">
                  Hạng mục
                </p>
                <CategoryPicker
                  categories={
                    type === 'income'
                      ? incomeCategories
                      : expenseCategories
                  }
                  selectedCategory={category}
                  onSelectCategory={setCategory}
                  type={type}
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Icon
                  name="account_balance_wallet"
                  className="text-zinc-500"
                />
                <select
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  className="form-select w-full border-0 border-b border-zinc-200 dark:border-zinc-700 bg-transparent rounded-none px-0 text-sm focus:ring-0 focus:border-amber-500"
                >
                  {wallets.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="flex items-center gap-3">
            <Icon
              name="description"
              className="text-zinc-500"
            />
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú (không bắt buộc)"
              className="form-input w-full border-0 border-b border-zinc-200 dark:border-zinc-700 bg-transparent rounded-none px-0 text-sm focus:ring-0 focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={handleSave}
          className="w-full h-12 rounded-full bg-amber-500 text-amber-950 text-sm font-semibold tracking-wide shadow-md active:scale-[0.99]"
        >
          LƯU GIAO DỊCH
        </button>
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
    <div
      className="fixed inset-0 z-40 max-w-lg mx-auto bg-black/40"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 w-full bg-zinc-50 dark:bg-zinc-900 rounded-t-2xl p-4 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="w-full h-11 rounded-xl bg-zinc-200/80 dark:bg-zinc-800/90 text-sm font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Sửa giao dịch
        </button>
        <button
          onClick={onDelete}
          className="w-full h-11 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-sm font-semibold text-rose-600 dark:text-rose-300"
        >
          Xoá giao dịch
        </button>
        <button
          onClick={onClose}
          className="w-full h-11 rounded-xl text-sm font-semibold text-zinc-500"
        >
          Huỷ
        </button>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center max-w-lg mx-auto bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl p-6 mx-4 w-full space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          Xoá giao dịch?
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Hành động này không thể hoàn tác.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl bg-zinc-200/80 dark:bg-zinc-800/90 text-xs font-semibold"
          >
            Huỷ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 rounded-xl bg-rose-600 text-xs font-semibold text-white"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
};

const ActivityLogModal: FC<{
  isOpen: boolean;
  onClose: () => void;
  logs: ActivityLogEntry[];
}> = ({ isOpen, onClose, logs }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto bg-zinc-50 dark:bg-zinc-900">
      <header className="flex items-center justify-between px-4 pt-3 pb-2 sticky top-0 bg-zinc-50/90 backdrop-blur dark:bg-zinc-900/90">
        <button
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
        >
          <Icon
            name="close"
            className="text-zinc-800 dark:text-zinc-100"
          />
        </button>
        <h2 className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-50">
          Lịch sử hoạt động
        </h2>
        <div className="w-11" />
      </header>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-center text-xs text-zinc-500 pt-8">
            Chưa có hoạt động nào.
          </p>
        ) : (
          [...logs]
            .sort(
              (a, b) =>
                b.timestamp.getTime() -
                a.timestamp.getTime()
            )
            .map((log) => (
              <div
                key={log.id}
                className="flex gap-3 items-start"
              >
                <div className="mt-1">
                  <Icon
                    name="history"
                    className="text-zinc-400"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-zinc-900 dark:text-zinc-50">
                    {log.message}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {log.timestamp.toLocaleString('vi-VN')}
                  </p>
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
}> = ({
  isOpen,
  onClose,
  onSave,
  currentBalances,
}) => {
  const [balances, setBalances] =
    useState(currentBalances);

  useEffect(() => {
    if (isOpen) {
      setBalances(currentBalances);
    }
  }, [isOpen, currentBalances]);

  if (!isOpen) return null;

  const handleAmountChange = (
    wallet: string,
    value: string
  ) => {
    const numericValue = parseFormattedAmount(value);
    setBalances((prev) => ({
      ...prev,
      [wallet]: numericValue,
    }));
  };

  const handleSave = () => {
    onSave(balances);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col max-w-lg mx-auto bg-zinc-50 dark:bg-zinc-900">
      <header className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
        >
          <Icon
            name="close"
            className="text-zinc-800 dark:text-zinc-100"
          />
        </button>
        <h2 className="text-base font-semibold tracking-wide text-zinc-900 dark:text-zinc-50">
          Tồn quỹ đầu kỳ
        </h2>
        <div className="w-11" />
      </header>
      <div className="flex-1 px-4 pb-4 space-y-5 overflow-y-auto">
        <p className="text-xs text-zinc-500">
          Nhập số dư ban đầu cho từng ví. Tồn quỹ hiện tại
          sẽ được tính dựa trên số này.
        </p>
        <div className="space-y-4">
          {wallets.map((wallet) => (
            <div key={wallet} className="space-y-1">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                {wallet}
              </label>
              <input
                type="text"
                value={formatAmountInput(
                  String(balances[wallet] || 0)
                )}
                onChange={(e) =>
                  handleAmountChange(
                    wallet,
                    e.target.value
                  )
                }
                className="form-input w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                placeholder="0"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4">
        <button
          onClick={handleSave}
          className="w-full h-11 rounded-full bg-amber-500 text-amber-950 text-sm font-semibold tracking-wide shadow-md active:scale-[0.99]"
        >
          LƯU TỒN ĐẦU KỲ
        </button>
      </div>
    </div>
  );
};

const LedgerScreen: FC = () => {
  const [transactions, setTransactions] = useState<
    Transaction[]
  >([]);
  const [isLoading, setIsLoading] =
    useState<boolean>(true);
  const [activityLog, setActivityLog] = useState<
    ActivityLogEntry[]
  >([]);
  const [openingBalances, setOpeningBalances] =
    useState<Record<string, number>>(
      wallets.reduce(
        (acc, w) => ({ ...acc, [w]: 0 }),
        {} as Record<string, number>
      )
    );

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error(
            'Lỗi tải dữ liệu Supabase:',
            error
          );
          alert(
            'Không tải được dữ liệu sổ quỹ. Kiểm tra lại Supabase.'
          );
          return;
        }

        if (data) {
          const mapped = data.map((row: any) => ({
            id: row.id,
            type: row.type as TransactionType,
            category: row.category || undefined,
            wallet: row.wallet || undefined,
            fromWallet: row.from_wallet || undefined,
            toWallet: row.to_wallet || undefined,
            amount: row.amount,
            note: row.note || undefined,
            createdAt: new Date(row.created_at),
            updatedAt: row.updated_at
              ? new Date(row.updated_at)
              : undefined,
          })) as Transaction[];

          setTransactions(mapped);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] =
    useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] =
    useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isOpeningBalanceOpen, setIsOpeningBalanceOpen] =
    useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] =
    useState<DateFilter>('today');
  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>('all');

  const addLog = (message: string) => {
    setActivityLog((prev) => [
      {
        id: Date.now(),
        timestamp: new Date(),
        message,
      },
      ...prev,
    ]);
  };

  const handleSaveTransaction = async (
    transactionData: Omit<
      Transaction,
      'id' | 'createdAt' | 'updatedAt'
    >,
    id?: number
  ) => {
    if (
      !transactionData.amount ||
      (!transactionData.wallet &&
        transactionData.type !== 'transfer')
    ) {
      alert('Vui lòng nhập đủ thông tin');
      return;
    }

    if (id) {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .update({
          type: transactionData.type,
          category: transactionData.category ?? null,
          wallet: transactionData.wallet ?? null,
          from_wallet:
            transactionData.fromWallet ?? null,
          to_wallet:
            transactionData.toWallet ?? null,
          amount: transactionData.amount,
          note: transactionData.note ?? null,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Lỗi sửa giao dịch:', error);
        alert('Lỗi khi sửa giao dịch');
        return;
      }

      setTransactions((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...transactionData,
                amount: transactionData.amount,
                updatedAt: data.updated_at
                  ? new Date(data.updated_at)
                  : new Date(),
              }
            : t
        )
      );

      addLog(`Đã sửa giao dịch #${id}.`);
    } else {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('transactions')
        .insert([
          {
            type: transactionData.type,
            category: transactionData.category ?? null,
            wallet: transactionData.wallet ?? null,
            from_wallet:
              transactionData.fromWallet ?? null,
            to_wallet:
              transactionData.toWallet ?? null,
            amount: transactionData.amount,
            note: transactionData.note ?? null,
            created_at: now,
            updated_at: now,
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
        type: data.type as TransactionType,
        category: data.category || undefined,
        wallet: data.wallet || undefined,
        fromWallet: data.from_wallet || undefined,
        toWallet: data.to_wallet || undefined,
        amount: data.amount,
        note: data.note || undefined,
        createdAt: new Date(data.created_at),
        updatedAt: data.updated_at
          ? new Date(data.updated_at)
          : undefined,
      };

      setTransactions((prev) => [newTx, ...prev]);
      addLog(
        `Đã thêm giao dịch mới: ${formatCurrency(
          newTx.amount
        )}.`
      );
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
        `Đã xoá giao dịch: ${
          selectedTransaction.category
        } (${formatCurrency(
          selectedTransaction.amount
        )})`
      );
    }

    setTransactions((prev) =>
      prev.filter((t) => t.id !== id)
    );
    setIsDeleteConfirmOpen(false);
    setSelectedTransaction(null);
  };

  const handleOpenActionSheet = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setIsActionSheetOpen(true);
  };

  const handleEdit = () => {
    if (!selectedTransaction) return;
    setEditingTransaction(selectedTransaction);
    setIsModalOpen(true);
    setIsActionSheetOpen(false);
  };

  const handleDelete = () => {
    setIsDeleteConfirmOpen(true);
    setIsActionSheetOpen(false);
  };

  const handleSaveOpeningBalances = (
    balances: Record<string, number>
  ) => {
    wallets.forEach((wallet) => {
      if (
        openingBalances[wallet] !==
        balances[wallet]
      ) {
        addLog(
          `Tồn đầu kỳ "${wallet}" đã thay đổi từ ${formatCurrency(
            openingBalances[wallet] || 0
          )} thành ${formatCurrency(
            balances[wallet] || 0
          )}.`
        );
      }
    });
    setOpeningBalances(balances);
    setIsOpeningBalanceOpen(false);
  };

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(
      startOfWeek.getDate() -
        now.getDay() +
        (now.getDay() === 0 ? -6 : 1)
    );
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    return transactions.filter((tx) => {
      const lowercasedFilter = searchTerm.toLowerCase();
      const searchMatch =
        !lowercasedFilter ||
        tx.category
          ?.toLowerCase()
          .includes(lowercasedFilter) ||
        tx.note
          ?.toLowerCase()
          .includes(lowercasedFilter);

      const txDate = tx.createdAt;
      let dateMatch = false;
      if (dateFilter === 'today')
        dateMatch = txDate >= startOfDay;
      else if (dateFilter === 'week')
        dateMatch = txDate >= startOfWeek;
      else if (dateFilter === 'month')
        dateMatch = txDate >= startOfMonth;

      const typeMatch =
        typeFilter === 'all' ||
        tx.type === typeFilter;

      return searchMatch && dateMatch && typeMatch;
    });
  }, [transactions, dateFilter, typeFilter, searchTerm]);

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce<
      Record<string, Transaction[]>
    >((acc, tx) => {
      const dateKey = tx.createdAt.toDateString();
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(tx);
      return acc;
    }, {});
  }, [filteredTransactions]);

  const {
    balances,
    totalBalance,
    totalIncome,
    totalExpense,
  } = useMemo(() => {
    const balances: Record<string, number> =
      wallets.reduce(
        (acc: Record<string, number>, w) => ({
          ...acc,
          [w]: openingBalances[w] || 0,
        }),
        {} as Record<string, number>
      );

    transactions.forEach((tx) => {
      if (tx.type === 'transfer') {
        if (
          tx.fromWallet &&
          balances[tx.fromWallet] !== undefined
        )
          balances[tx.fromWallet] -= tx.amount;
        if (
          tx.toWallet &&
          balances[tx.toWallet] !== undefined
        )
          balances[tx.toWallet] += tx.amount;
      } else {
        if (
          tx.wallet &&
          balances[tx.wallet] !== undefined
        ) {
          balances[tx.wallet] += tx.amount;
        }
      }
    });

    const totalBalance = Object.values(balances).reduce(
      (sum, b) => sum + b,
      0
    );

    const { income, expense } = filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.type === 'income')
          acc.income += tx.amount;
        else if (tx.type === 'expense')
          acc.expense += tx.amount;
        return acc;
      },
      { income: 0, expense: 0 }
    );

    return {
      balances,
      totalBalance,
      totalIncome: income,
      totalExpense: expense,
    };
  }, [transactions, filteredTransactions, openingBalances]);

  const dateOptions: Record<DateFilter, string> = {
    today: 'Hôm nay',
    week: 'Tuần này',
    month: 'Tháng này',
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 pb-24 max-w-lg mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={() => setIsOpeningBalanceOpen(true)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <Icon
              name="settings"
              className="text-zinc-800 dark:text-zinc-100"
            />
          </button>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] tracking-[0.2em] font-semibold text-amber-600 uppercase">
              SỔ QUỸ TAWA
            </span>
            <span className="text-xs font-medium text-zinc-500">
              QUẬN 1
            </span>
          </div>
          <button
            onClick={() => setIsLogOpen(true)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-zinc-200/70 dark:hover:bg-zinc-800"
          >
            <Icon
              name="history"
              className="text-zinc-800 dark:text-zinc-100"
            />
          </button>
        </div>

        {/* Banner */}
        <div className="mx-4 mb-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-1.5 flex items-center gap-2">
          <Icon
            name="offline_bolt"
            className="text-amber-500 text-base"
          />
          <p className="text-[11px] text-amber-700 leading-snug">
            Chế độ kết nối Supabase • Dữ liệu sổ quỹ được
            lưu online
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Top summary */}
        <div className="px-4 pt-1 space-y-3">
          {/* Tổng tồn quỹ */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-amber-50 to-rose-50 dark:from-emerald-900/30 dark:via-amber-900/20 dark:to-rose-900/30 px-4 py-4 shadow-sm border border-white/80 dark:border-zinc-800">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-zinc-500 uppercase">
              TỔNG TỒN QUỸ
            </p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatCurrency(totalBalance)}
            </p>
          </div>

          {/* Ví */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(balances).map(
              ([wallet, balance]) => {
                const isCash = wallet === 'Ví Tiền mặt';
                const cardClasses = isCash
                  ? 'bg-emerald-50 border-emerald-100'
                  : 'bg-sky-50 border-sky-100';
                const walletTextClasses = isCash
                  ? 'text-emerald-700'
                  : 'text-sky-700';
                const balanceTextClasses = isCash
                  ? 'text-emerald-900'
                  : 'text-sky-900';

                const iconName = isCash
                  ? 'payments'
                  : 'account_balance';

                return (
                  <div
                    key={wallet}
                    className={`rounded-2xl border px-3 py-3 flex flex-col gap-1 ${cardClasses}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Icon
                          name={iconName}
                          className={`text-xs ${walletTextClasses}`}
                        />
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-wide ${walletTextClasses}`}
                        >
                          {wallet}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-2xl font-bold tracking-tight ${balanceTextClasses}`}
                    >
                      {formatCurrency(
                        balance as number
                      )}
                    </p>
                  </div>
                );
              }
            )}
          </div>

          {/* Thu / Chi / Chênh lệch */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-emerald-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-emerald-600">
                TỔNG THU
              </p>
              <p className="mt-1 text-lg font-bold text-emerald-700">
                {formatCurrency(totalIncome, true)}
              </p>
            </div>
            <div className="rounded-2xl bg-rose-50 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-rose-600">
                TỔNG CHI
              </p>
              <p className="mt-1 text-lg font-bold text-rose-700">
                {formatCurrency(totalExpense)}
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-100 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-zinc-600">
                CHÊNH LỆCH
              </p>
              <p className="mt-1 text-lg font-bold text-zinc-900">
                {formatCurrency(
                  totalIncome + totalExpense
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Bộ lọc + tìm kiếm */}
        <div className="px-4 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 shadow-sm">
            <Icon
              name='search'
              className="text-zinc-400 text-sm"
            />
            <input
              value={searchTerm}
              onChange={(e) =>
                setSearchTerm(e.target.value)
              }
              className="flex-1 bg-transparent border-none text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
              placeholder="Tìm theo hạng mục, ghi chú..."
            />
          </div>
          <div className="flex gap-2">
            <select
              value={dateFilter}
              onChange={(e) =>
                setDateFilter(
                  e.target.value as DateFilter
                )
              }
              className="flex-1 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-[11px] text-zinc-700 dark:text-zinc-200 focus:ring-0 focus:outline-none"
            >
              <option value="today">
                Hôm nay
              </option>
              <option value="week">
                Tuần này
              </option>
              <option value="month">
                Tháng này
              </option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value as TypeFilter
                )
              }
              className="flex-1 h-9 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-[11px] text-zinc-700 dark:text-zinc-200 focus:ring-0 focus:outline-none"
            >
              <option value="all">Tất cả</option>
              <option value="income">Thu</option>
              <option value="expense">Chi</option>
              <option value="transfer">
                Chuyển tiền
              </option>
            </select>
          </div>
        </div>

        {/* List giao dịch */}
        <div className="flex flex-col pb-4">
          {isLoading ? (
            <p className="text-center text-xs text-zinc-400 pt-8">
              Đang tải dữ liệu...
            </p>
          ) : Object.entries(groupedTransactions)
              .length === 0 ? (
            <p className="text-center text-xs text-zinc-500 pt-8">
              Không có giao dịch nào.
            </p>
          ) : (
            Object.entries(groupedTransactions)
              .sort(
                ([dateA], [dateB]) =>
                  new Date(dateB).getTime() -
                  new Date(dateA).getTime()
              )
              .map(([date, txs]) => (
                <div key={date}>
                  <h4 className="px-4 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-amber-600 uppercase">
                    {new Date(
                      date
                    ).toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h4>
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white/70 dark:bg-zinc-900/60">
                    {[...(txs as Transaction[])]

                      .sort(
                        (a, b) =>
                          b.createdAt.getTime() -
                          a.createdAt.getTime()
                      )
                      .map((tx) => {
                        const isIncome =
                          tx.type === 'income';
                        const isExpense =
                          tx.type === 'expense';
                        const isTransfer =
                          tx.type === 'transfer';

                        const iconName = isIncome
                          ? 'south_west'
                          : isExpense
                          ? 'north_east'
                          : 'swap_horiz';
                        const colorClasses =
                          isIncome
                            ? 'bg-emerald-50 text-emerald-600'
                            : isExpense
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-sky-50 text-sky-600';
                        const amountColor =
                          isIncome
                            ? 'text-emerald-600'
                            : isExpense
                            ? 'text-rose-600'
                            : 'text-sky-600';

                        return (
                          <button
                            key={tx.id}
                            type="button"
                            onClick={() =>
                              handleOpenActionSheet(
                                tx
                              )
                            }
                            className="w-full flex items-start justify-between px-4 py-3 gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/80"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div
                                className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${colorClasses}`}
                              >
                                <Icon name={iconName} />
                              </div>
                              <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 truncate max-w-[180px]">
                                  {isTransfer
                                    ? 'Chuyển tiền'
                                    : tx.category}
                                </p>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                                  {isTransfer
                                    ? `Từ ${tx.fromWallet} → ${tx.toWallet}`
                                    : tx.wallet}
                                </p>
                                {tx.note && (
                                  <p className="text-[10px] italic text-zinc-400 truncate max-w-[220px]">
                                    "{tx.note}"
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-0.5 shrink-0">
                              <p
                                className={`text-xs font-semibold ${amountColor}`}
                              >
                                {formatCurrency(
                                  tx.amount
                                )}
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {tx.createdAt.toLocaleTimeString(
                                  'vi-VN',
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </p>
                              {tx.updatedAt && (
                                <p className="text-[9px] text-zinc-400 italic">
                                  Đã sửa
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))
          )}
        </div>
      </main>

      {/* Nút + */}
      <button
        onClick={() => {
          setEditingTransaction(null);
          setIsModalOpen(true);
        }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/40 active:scale-[0.97]"
      >
        <Icon name="add" className="!text-3xl" />
      </button>

      {/* Modals */}
      <AddEditTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        transactionToEdit={editingTransaction}
      />
      <ActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDeleteTransaction}
      />
      <ActivityLogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={activityLog}
      />
      <OpeningBalanceModal
        isOpen={isOpeningBalanceOpen}
        onClose={() => setIsOpeningBalanceOpen(false)}
        onSave={handleSaveOpeningBalances}
        currentBalances={openingBalances}
      />
    </div>
  );
};

export default LedgerScreen;
