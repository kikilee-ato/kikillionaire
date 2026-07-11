'use client';

import React, { useEffect, useState, useCallback } from 'react';
import styles from '../page.module.css';
import { Card } from '@/components/ui/Card';
import { Transaction } from '@/lib/googleSheets';

type FilterType = 'All' | 'Expense' | 'Income' | 'Transfer';

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<FilterType>('All');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  if (isLoading) {
    return <div className={styles.loading}>Loading History...</div>;
  }

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'All') return true;
    return tx.Category === filter;
  });

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.appTitle}>History</h1>
          <p className={styles.appSubtitle}>Transaction records</p>
        </div>
      </header>

      {/* Filter Toggles */}
      <div className={styles.tabs} style={{ margin: 'var(--space-xs) 0 var(--space-sm) 0' }}>
        {(['All', 'Expense', 'Income', 'Transfer'] as FilterType[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.tab} ${filter === t ? styles.activeTab : ''}`}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <section className={styles.transactionsSection}>
        <Card className={styles.transactionsCard} noPadding>
          {filteredTransactions.length === 0 ? (
            <div className={styles.noTx}>No transactions found.</div>
          ) : (
            <div className={styles.txList} style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {filteredTransactions.map((tx, i) => (
                <div key={i} className={styles.txItem}>
                  <div className={styles.txMain}>
                    <span className={styles.txMerchant}>
                      {tx.Category === 'Transfer' ? `${tx.FromAsset} ➔ ${tx.ToAsset}` : tx.SubCategory || tx.Merchant}
                    </span>
                    <span className={styles.txDate}>{tx.Date}</span>
                  </div>
                  <span className={`${styles.txAmount} ${styles[tx.Category.toLowerCase()]}`}>
                    {tx.Category === 'Expense' ? '-' : tx.Category === 'Income' ? '+' : ''}
                    {tx.Currency === 'EUR' ? `€${Number(tx.Amount).toFixed(2)}` : `₩${Math.round(Number(tx.Amount)).toLocaleString()}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
