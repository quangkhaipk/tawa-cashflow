export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
    id: number;
    type: TransactionType;
    category?: string;
    wallet?: string;
    fromWallet?: string;
    toWallet?: string;
    amount: number;
    note?: string;
    created_at: Date;
    updated_at?: Date;
}
