'use client';

import React, { useEffect, useState, useCallback } from 'react';
import styles from '../page.module.css';
import { Card } from '@/components/ui/Card';

interface DashboardData {
  eurToKrw: number;
  metrics: {
    availableAssetsEUR: number;
    monthlyExpenseEUR: number;
    monthlyIncomeEUR: number;
    runwayMonths: number;
    dailyBudgetEUR: number;
  };
}

export default function Insights() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading && !data) {
    return <div className={styles.loading}>Loading Insights...</div>;
  }

  const metrics = data?.metrics;
  const runwayMonths = metrics?.runwayMonths ?? Infinity;
  const availableAssetsEUR = metrics?.availableAssetsEUR ?? 0;
  const monthlyExpenseEUR = metrics?.monthlyExpenseEUR ?? 0;
  const monthlyIncomeEUR = metrics?.monthlyIncomeEUR ?? 0;
  const dailyBudgetEUR = metrics?.dailyBudgetEUR ?? 0;

  let runwayText = 'N/A';
  if (runwayMonths === Infinity) {
    runwayText = 'Keep Alive (Income >= Expense)';
  } else if (runwayMonths < 1) {
    runwayText = `${Math.round(runwayMonths * 30)} Days`;
  } else {
    runwayText = `${runwayMonths.toFixed(1)} Months`;
  }

  const burnRatePercent = runwayMonths !== Infinity 
    ? Math.min(100, Math.max(0, 100 - (runwayMonths * 10))) 
    : 0;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.appTitle}>Insights</h1>
          <p className={styles.appSubtitle}>Survival analytics</p>
        </div>
      </header>

      {metrics && (
        <>
          <section className={styles.metricsGrid}>
            <Card className={styles.metricCard}>
              <span className={styles.metricLabel}>Available Cash</span>
              <span className={styles.metricValue}>€ {availableAssetsEUR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </Card>
            <Card className={styles.metricCard}>
              <span className={styles.metricLabel}>Monthly Expenses</span>
              <span className={styles.metricValue}>€ {monthlyExpenseEUR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </Card>
          </section>

          <Card className={`${styles.runwayDetailCard} ${runwayMonths < 3 ? styles.dangerCard : ''}`}>
            <div className={styles.runwayProgressHeader}>
              <span>Budget Burn Rate Indicator</span>
              <span>{runwayMonths === Infinity ? '0' : burnRatePercent.toFixed(0)}% Burned</span>
            </div>
            <div className={styles.progressBarBg}>
              <div 
                className={styles.progressBarFill} 
                style={{ width: `${runwayMonths === Infinity ? 0 : burnRatePercent}%` }} 
              />
            </div>
            <h2 className={styles.runwayHighlight}>Runway: {runwayText}</h2>
            <p className={styles.runwayAdvice}>
              {runwayMonths < 3 
                ? '🚨 Warning: Your emergency budget is under 3 months! You need to reduce non-essential expenses immediately.'
                : runwayMonths === Infinity 
                ? '👍 Congratulations! Your income covers all your expenses. The budget is expanding.'
                : '👍 Safe range. Your budget is healthy and supports the current lifestyle.'}
            </p>
          </Card>

          <Card className={styles.metricCard}>
            <span className={styles.metricLabel}>Daily Recommended Limit</span>
            <span className={styles.metricValue}>€ {dailyBudgetEUR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
              Suggested maximum daily spending to stay within your available budget for the next 30 days.
            </p>
          </Card>
        </>
      )}
    </main>
  );
}
