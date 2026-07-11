'use client';

import React, { useState, useEffect } from 'react';
import styles from './FastEntryForm.module.css';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { appendRow, Asset } from '@/lib/googleSheets';

// Fallback assets in case dynamic fetch is loading or fails
const FALLBACK_EXPENSE_ASSETS = ['Travel Wallet', 'Cash (EUR)', 'N26', 'KR Bank Deposit'];
const FALLBACK_ALL_ASSETS = ['Travel Wallet', 'N26', 'KR Bank Deposit', 'KR Bank Savings', 'KR Stocks', 'Cash (EUR)'];

const EXPENSE_CATEGORIES = [
  'Food/Groceries',
  'Dining/Cafes',
  'Housing/Utilities',
  'Transportation',
  'Shopping',
  'Leisure/Travel',
  'Others'
];

type EntryType = 'Expense' | 'Income' | 'Transfer';

interface FastEntryFormProps {
  onSuccess?: () => void;
}

export default function FastEntryForm({ onSuccess }: FastEntryFormProps) {
  const [type, setType] = useState<EntryType>('Expense');
  const [amount, setAmount] = useState('');
  
  // Dynamic assets list from database
  const [expenseAssets, setExpenseAssets] = useState<string[]>(FALLBACK_EXPENSE_ASSETS);
  const [allAssets, setAllAssets] = useState<string[]>(FALLBACK_ALL_ASSETS);
  const [dbAssets, setDbAssets] = useState<Asset[]>([]);
  const [eurToKrw, setEurToKrw] = useState(1450);

  const [fromAsset, setFromAsset] = useState(FALLBACK_EXPENSE_ASSETS[0]);
  const [toAsset, setToAsset] = useState(FALLBACK_ALL_ASSETS[1]);
  
  const [subCategory, setSubCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [isLoading, setIsLoading] = useState(false);

  // Input Currency Toggle State
  const [inputCurrency, setInputCurrency] = useState<'EUR' | 'KRW'>('EUR');

  // Fetch dynamic assets from Sheets to populate dropdowns
  useEffect(() => {
    async function loadAssets() {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const json = await res.json();
          const assetsList: Asset[] = json.assets || [];
          setEurToKrw(json.eurToKrw || 1450);
          setDbAssets(assetsList);

          if (assetsList.length > 0) {
            const names = assetsList.map(a => a.AssetName);
            
            // Spendable assets (Wallet, Cash, Deposit)
            const spendable = assetsList
              .filter(a => a.AssetType === 'Wallet' || a.AssetType === 'Cash' || a.AssetType === 'Deposit')
              .map(a => a.AssetName);
            
            setAllAssets(names);
            if (spendable.length > 0) {
              setExpenseAssets(spendable);
              setFromAsset(spendable[0]);
              // Set default input currency based on initial asset currency
              const initialAsset = assetsList.find(a => a.AssetName === spendable[0]);
              if (initialAsset) setInputCurrency(initialAsset.Currency);
            }
            if (names.length > 1) {
              setToAsset(names[1]);
            }
          }
        }
      } catch (e) {
        console.error('Failed to load dynamic assets for entry form:', e);
      }
    }
    loadAssets();
  }, []);

  // Sync input currency when selected fromAsset changes
  useEffect(() => {
    const selected = dbAssets.find(a => a.AssetName === fromAsset);
    if (selected) {
      setInputCurrency(selected.Currency);
    }
  }, [fromAsset, dbAssets]);

  const handleCurrencyToggle = (isKRW: boolean) => {
    const nextCurrency = isKRW ? 'KRW' : 'EUR';
    if (nextCurrency !== inputCurrency && amount) {
      const val = Number(amount);
      if (!isNaN(val)) {
        if (nextCurrency === 'KRW') {
          setAmount(Math.round(val * eurToKrw).toString());
        } else {
          setAmount((val / eurToKrw).toFixed(2));
        }
      }
    }
    setInputCurrency(nextCurrency);
  };

  const handleQuickAdd = (val: number) => {
    const current = Number(amount) || 0;
    setAmount((current + val).toString());
  };

  const handleSetAll = () => {
    const asset = dbAssets.find(a => a.AssetName === fromAsset);
    if (!asset) return;
    const balance = Number(asset.Balance) || 0;

    if (inputCurrency === asset.Currency) {
      setAmount(balance.toString());
    } else if (inputCurrency === 'EUR' && asset.Currency === 'KRW') {
      setAmount((balance / eurToKrw).toFixed(2));
    } else if (inputCurrency === 'KRW' && asset.Currency === 'EUR') {
      setAmount(Math.round(balance * eurToKrw).toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return alert('Please enter an amount.');

    setIsLoading(true);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Convert logged amount to match selected FromAsset's currency if they differ
    const asset = dbAssets.find(a => a.AssetName === fromAsset);
    let finalAmount = Number(amount);
    let finalCurrency = inputCurrency;

    // Log the transaction in the currency matching the source asset
    if (asset && asset.Currency !== inputCurrency) {
      if (asset.Currency === 'EUR') {
        finalAmount = Number((finalAmount / eurToKrw).toFixed(2));
      } else {
        finalAmount = Math.round(finalAmount * eurToKrw);
      }
      finalCurrency = asset.Currency;
    }

    const newTx = {
      Date: dateStr,
      Category: type,
      SubCategory: type === 'Expense' ? subCategory : '',
      FromAsset: fromAsset,
      ToAsset: type === 'Transfer' ? toAsset : '',
      Amount: finalAmount,
      Currency: finalCurrency,
      Merchant: type === 'Transfer' ? 'Transfer' : 'Manual Entry',
      Memo: ''
    };

    const res = await appendRow('Transactions', newTx);
    setIsLoading(false);

    if (res.success) {
      alert('Successfully registered.');
      setAmount('');
      if (onSuccess) onSuccess();
    } else {
      alert(`Error occurred: ${res.error}`);
    }
  };

  return (
    <Card className={styles.container}>
      <h3 className={styles.title}>Quick Entry</h3>
      
      <div className={styles.tabs}>
        <button 
          type="button"
          className={`${styles.tab} ${type === 'Expense' ? styles.activeTab : ''}`}
          onClick={() => setType('Expense')}
        >Expense</button>
        <button 
          type="button"
          className={`${styles.tab} ${type === 'Income' ? styles.activeTab : ''}`}
          onClick={() => setType('Income')}
        >Income</button>
        <button 
          type="button"
          className={`${styles.tab} ${type === 'Transfer' ? styles.activeTab : ''}`}
          onClick={() => setType('Transfer')}
        >Transfer</button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {type === 'Expense' && (
          <div className={styles.formGroup}>
            <label>Category</label>
            <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        )}

        <div className={styles.assetGroup}>
          <div className={styles.formGroup}>
            <label>{type === 'Income' ? 'Target Asset' : 'Source Asset'}</label>
            <select value={fromAsset} onChange={(e) => setFromAsset(e.target.value)}>
              {expenseAssets.map((a, idx) => <option key={`${a}-${idx}`} value={a}>{a}</option>)}
            </select>
          </div>

          {type === 'Transfer' && (
            <>
              <div className={styles.transferIcon}>➔</div>
              <div className={styles.formGroup}>
                <label>Target Asset</label>
                <select value={toAsset} onChange={(e) => setToAsset(e.target.value)}>
                  {allAssets.map((a, idx) => <option key={`${a}-${idx}`} value={a}>{a}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Amount Input with Currency Toggle */}
        <div className={styles.formGroup}>
          <div className={styles.amountHeader}>
            <label>Amount</label>
            <ToggleSwitch 
              isOn={inputCurrency === 'KRW'} 
              onToggle={handleCurrencyToggle}
              labelLeft="EUR"
              labelRight="KRW"
            />
          </div>
          <div className={styles.inputWrapper}>
            <input 
              type="number" 
              step="0.01"
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              placeholder="0.00" 
              required 
            />
            {amount && (
              <button 
                type="button" 
                className={styles.clearBtn} 
                onClick={() => setAmount('')}
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Quick Amount Buttons */}
          <div className={styles.quickButtons}>
            {inputCurrency === 'EUR' ? (
              <>
                <button type="button" onClick={() => handleQuickAdd(10)}>+10</button>
                <button type="button" onClick={() => handleQuickAdd(50)}>+50</button>
                <button type="button" onClick={() => handleQuickAdd(100)}>+100</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => handleQuickAdd(10000)}>+1만</button>
                <button type="button" onClick={() => handleQuickAdd(50000)}>+5만</button>
                <button type="button" onClick={() => handleQuickAdd(100000)}>+10만</button>
              </>
            )}
            {type === 'Transfer' && (
              <button type="button" className={styles.allBtn} onClick={handleSetAll}>All</button>
            )}
          </div>
        </div>

        <Button fullWidth type="submit" disabled={isLoading}>
          {isLoading ? 'Registering...' : 'Add Transaction'}
        </Button>
      </form>
    </Card>
  );
}
