'use client';

import React, { useEffect, useState, useCallback } from 'react';
import styles from './page.module.css';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Asset, Transaction } from '@/lib/googleSheets';

interface DashboardData {
  eurToKrw: number;
  assets: Asset[];
}

const EXPENSE_CATEGORIES = [
  'Food/Groceries',
  'Dining/Cafes',
  'Housing/Utilities',
  'Transportation',
  'Shopping',
  'Leisure/Travel',
  'Others'
];

const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {
  'Food/Groceries': 300,
  'Dining/Cafes': 150,
  'Housing/Utilities': 200,
  'Transportation': 100,
  'Shopping': 100,
  'Leisure/Travel': 100,
  'Others': 50
};

export default function Insights() {
  const [dbData, setDbData] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currency, setCurrency] = useState<'EUR' | 'KRW'>('EUR');
  const [isLoading, setIsLoading] = useState(true);

  // Budgets state (stored in EUR base)
  const [overallBudgetEUR, setOverallBudgetEUR] = useState(1000);
  const [categoryBudgetsEUR, setCategoryBudgetsEUR] = useState<Record<string, number>>(DEFAULT_CATEGORY_BUDGETS);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editOverall, setEditOverall] = useState('');
  const [editCategories, setEditCategories] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resDash, resTx] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/transactions')
      ]);

      if (resDash.ok && resTx.ok) {
        const dashJson = await resDash.json();
        const txJson = await resTx.json();
        setDbData(dashJson);
        setTransactions(txJson);
      }
    } catch (error) {
      console.error('Error loading insights data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load budgets from localStorage
  useEffect(() => {
    fetchData();

    const storedOverall = localStorage.getItem('overall_budget');
    const storedCategories = localStorage.getItem('category_budgets');

    if (storedOverall) {
      setOverallBudgetEUR(Number(storedOverall));
    }
    if (storedCategories) {
      try {
        setCategoryBudgetsEUR(JSON.parse(storedCategories));
      } catch (e) {
        console.error('Failed to parse stored category budgets', e);
      }
    }
  }, [fetchData]);

  if (isLoading && (!dbData || transactions.length === 0)) {
    return <div className={styles.loading}>Loading Insights...</div>;
  }

  const eurToKrw = dbData?.eurToKrw || 1450;
  const assets = dbData?.assets || [];

  // 1. Calculate Available Assets
  const totalAvailableEUR = assets
    .filter(a => a.AssetType !== 'Savings' && a.AssetType !== 'Stocks')
    .reduce((sum, asset) => {
      const balance = Number(asset.Balance) || 0;
      return sum + (asset.Currency === 'KRW' ? balance / eurToKrw : balance);
    }, 0);

  // 2. Filter this month's expenses
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const thisMonthExpenses = transactions.filter(tx => {
    if (tx.Category !== 'Expense') return false;
    const txDate = new Date(tx.Date);
    return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
  });

  // Calculate total monthly expense in EUR
  const totalExpenseEUR = thisMonthExpenses.reduce((sum, tx) => {
    const amount = Number(tx.Amount) || 0;
    return sum + (tx.Currency === 'KRW' ? amount / eurToKrw : amount);
  }, 0);

  // Calculate category-wise monthly expenses in EUR
  const categoryExpensesEUR: Record<string, number> = {};
  EXPENSE_CATEGORIES.forEach(cat => {
    categoryExpensesEUR[cat] = thisMonthExpenses
      .filter(tx => tx.SubCategory === cat)
      .reduce((sum, tx) => {
        const amount = Number(tx.Amount) || 0;
        return sum + (tx.Currency === 'KRW' ? amount / eurToKrw : amount);
      }, 0);
  });

  // Calculate Asset Exhaustion Date
  let exhaustionDateText = '';
  const passedDays = Math.max(1, now.getDate());
  const dailyBurnRate = totalExpenseEUR / passedDays;

  if (totalAvailableEUR <= 0) {
    exhaustionDateText = 'No available assets at the moment.';
  } else if (dailyBurnRate <= 0) {
    exhaustionDateText = 'No expenses this month. Cannot estimate exhaustion date.';
  } else {
    const remainingDays = totalAvailableEUR / dailyBurnRate;
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + remainingDays);
    
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const formattedExhaustionDate = `${yyyy}/${mm}/${dd}`;
    exhaustionDateText = `Est. exhaustion date: ${formattedExhaustionDate}`;
  }

  // 3. Format value based on currency toggle
  const formatValue = (valueEUR: number) => {
    if (currency === 'EUR') {
      return `€ ${valueEUR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      return `₩ ${Math.round(valueEUR * eurToKrw).toLocaleString()}`;
    }
  };

  const handleToggleCurrency = (isOn: boolean) => {
    setCurrency(isOn ? 'KRW' : 'EUR');
  };

  // Open Modal and populate temporary edit state (converting to current display currency)
  const openEditModal = () => {
    const rate = currency === 'KRW' ? eurToKrw : 1;
    setEditOverall(String(Math.round(overallBudgetEUR * rate)));

    const catsEdit: Record<string, string> = {};
    EXPENSE_CATEGORIES.forEach(cat => {
      const budgetVal = categoryBudgetsEUR[cat] !== undefined ? categoryBudgetsEUR[cat] : DEFAULT_CATEGORY_BUDGETS[cat];
      catsEdit[cat] = String(Math.round(budgetVal * rate));
    });
    setEditCategories(catsEdit);
    setIsModalOpen(true);
  };

  // Save edited values back to EUR and localStorage
  const handleSaveBudgets = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = currency === 'KRW' ? eurToKrw : 1;

    // Convert back to EUR base
    const nextOverallEUR = Number(editOverall) / rate;
    const nextCategoriesEUR: Record<string, number> = {};
    EXPENSE_CATEGORIES.forEach(cat => {
      nextCategoriesEUR[cat] = Number(editCategories[cat] || 0) / rate;
    });

    setOverallBudgetEUR(nextOverallEUR);
    setCategoryBudgetsEUR(nextCategoriesEUR);

    localStorage.setItem('overall_budget', String(nextOverallEUR));
    localStorage.setItem('category_budgets', JSON.stringify(nextCategoriesEUR));

    setIsModalOpen(false);
    alert('Budgets updated successfully.');
  };

  // Progress Bar Width Helper
  const getProgressWidth = (spent: number, target: number) => {
    if (target <= 0) return 0;
    return Math.min(100, (spent / target) * 100);
  };

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.appTitle}>Insights</h1>
          <p className={styles.appSubtitle}>Survival analytics & budgets</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.exchangeRate}>
            1 EUR = {Math.round(eurToKrw).toLocaleString()} KRW
          </div>
          <ToggleSwitch
            isOn={currency === 'KRW'}
            onToggle={handleToggleCurrency}
            labelLeft="EUR"
            labelRight="KRW"
          />
        </div>
      </header>

      {/* Row 1: Large Metrics (Numbers Only) */}
      <section className={styles.heroNumbers}>
        <div className={styles.heroCard}>
          <span className={styles.heroLabel}>This Month's Spending</span>
          <span className={styles.heroValue}>{formatValue(totalExpenseEUR)}</span>
        </div>
        <div className={styles.heroCard}>
          <span className={styles.heroLabel}>Total Available Assets</span>
          <span className={styles.heroValueSub}>{formatValue(totalAvailableEUR)}</span>
          <p className={styles.exhaustionText}>{exhaustionDateText}</p>
        </div>
      </section>

      {/* Row 2: Overall Budget Progress Bar */}
      <section className={styles.budgetSection}>
        <h3 className={styles.sectionTitle}>Monthly Total Budget</h3>
        <Card className={styles.budgetCard}>
          <div className={styles.progressInfo}>
            <span className={styles.progressLabel}>Overall Spent</span>
            <span className={styles.progressValue}>
              {formatValue(totalExpenseEUR)} / {formatValue(overallBudgetEUR)}
            </span>
          </div>
          <div className={styles.progressBarBg}>
            <div
              className={`${styles.progressBarFill} ${totalExpenseEUR > overallBudgetEUR ? styles.progressBarDanger : styles.progressBarNormal}`}
              style={{ width: `${getProgressWidth(totalExpenseEUR, overallBudgetEUR)}%` }}
            />
          </div>
        </Card>
      </section>

      {/* Row 3: Category Budget Progress Bars */}
      <section className={styles.categorySection}>
        <h3 className={styles.sectionTitle}>Category-wise Budgets</h3>
        <div className={styles.categoryList}>
          {EXPENSE_CATEGORIES.map(cat => {
            const spent = categoryExpensesEUR[cat] || 0;
            const target = categoryBudgetsEUR[cat] !== undefined ? categoryBudgetsEUR[cat] : DEFAULT_CATEGORY_BUDGETS[cat];

            return (
              <Card key={cat} className={styles.categoryCard}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryName}>{cat}</span>
                  <span className={styles.categoryProgress}>
                    {formatValue(spent)} / {formatValue(target)}
                  </span>
                </div>
                <div className={styles.progressBarBg}>
                  <div
                    className={`${styles.progressBarFill} ${spent > target ? styles.progressBarDanger : styles.progressBarNormal}`}
                    style={{ width: `${getProgressWidth(spent, target)}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Row 4: Modify Budget Button */}
      <div className={styles.footerButton}>
        <Button fullWidth onClick={openEditModal}>
          Modify Budgets
        </Button>
      </div>

      {/* Modify Budget Modal */}
      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Modify Monthly Budgets ({currency})</h3>

            <form onSubmit={handleSaveBudgets} className={styles.form}>
              <div className={styles.formGroup}>
                <label>Overall Monthly Budget</label>
                <input
                  type="number"
                  required
                  value={editOverall}
                  onChange={(e) => setEditOverall(e.target.value)}
                />
              </div>

              <h4 style={{ fontSize: '13px', margin: '8px 0 4px 0', color: 'var(--color-text-secondary)' }}>Category-wise</h4>
              {EXPENSE_CATEGORIES.map(cat => (
                <div key={cat} className={styles.formGroup}>
                  <label>{cat}</label>
                  <input
                    type="number"
                    required
                    value={editCategories[cat] || ''}
                    onChange={(e) => setEditCategories({
                      ...editCategories,
                      [cat]: e.target.value
                    })}
                  />
                </div>
              ))}

              <div className={styles.modalActions}>
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
