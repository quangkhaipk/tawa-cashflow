import React, { useState, useEffect, useCallback } from 'react';
import LedgerScreen from './screens/LedgerScreen';
import { supabase } from './supabaseClient';
import { Transaction } from './types';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      alert('Không thể tải dữ liệu giao dịch.');
    } else {
      // Convert date strings from Supabase back to Date objects
      const formattedData = data.map(tx => ({
        ...tx,
        amount: Number(tx.amount), // Ensure amount is a number
        created_at: new Date(tx.created_at),
        updated_at: tx.updated_at ? new Date(tx.updated_at) : undefined,
      }));
      setTransactions(formattedData as unknown as Transaction[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSaveTransaction = async (
    transactionData: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>,
    id?: number
  ) => {
    const dataToUpsert = {
      ...transactionData,
      from_wallet: transactionData.fromWallet,
      to_wallet: transactionData.toWallet,
    }
    // remove camelCase versions
    delete (dataToUpsert as any).fromWallet
    delete (dataToUpsert as any).toWallet

    if (id) {
      // Update existing transaction
      const { error } = await supabase
        .from('transactions')
        .update({ ...dataToUpsert, updated_at: new Date() })
        .eq('id', id);

      if (error) {
        console.error('Error updating transaction:', error);
        alert('Lỗi: Không thể cập nhật giao dịch.');
      } else {
        fetchTransactions(); // Refresh data
      }
    } else {
      // Create new transaction
      const { error } = await supabase.from('transactions').insert(dataToUpsert);
      if (error) {
        console.error('Error adding transaction:', error);
        alert('Lỗi: Không thể thêm giao dịch mới.');
      } else {
        fetchTransactions(); // Refresh data
      }
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      console.error('Error deleting transaction:', error);
      alert('Lỗi: Không thể xoá giao dịch.');
    } else {
      fetchTransactions(); // Refresh data
    }
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background-light dark:bg-background-dark">
      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col">
        {loading ? (
           <div className="flex-1 flex items-center justify-center">
             <p className="text-lg font-semibold animate-pulse">Đang tải dữ liệu...</p>
           </div>
        ) : (
          <LedgerScreen
            transactions={transactions}
            onSaveTransaction={handleSaveTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
      </div>
    </div>
  );
};

export default App;
