'use client';

import React, { useState, useEffect } from 'react';
import styles from './AssetEditModal.module.css';
import { Button } from './ui/Button';
import { Asset } from '@/lib/googleSheets';

interface AssetEditModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: Partial<Asset>) => Promise<void>;
}

export default function AssetEditModal({ asset, isOpen, onClose, onSave }: AssetEditModalProps) {
  const [balance, setBalance] = useState('');
  const [quantity, setQuantity] = useState('');
  const [extra, setExtra] = useState('');
  
  // Calculator state (only for Stocks)
  const [calcSpent, setCalcSpent] = useState('');
  const [calcQty, setCalcQty] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (asset) {
      setBalance(asset.Balance.toString());
      setQuantity(asset.Quantity?.toString() || '');
      setExtra(asset.Extra || '');
      // Reset calculator
      setCalcSpent('');
      setCalcQty('');
    }
  }, [asset]);

  if (!isOpen || !asset) return null;

  const applyCalculation = () => {
    const spent = Number(calcSpent) || 0;
    const qty = Number(calcQty) || 0;
    
    if (spent <= 0 || qty <= 0) {
      alert('Please enter valid purchase amount and quantity.');
      return;
    }

    const currentBalance = Number(balance) || 0;
    const currentQty = Number(quantity) || 0;

    // Update form fields (simply accumulate values)
    setBalance((currentBalance + spent).toString());
    setQuantity((currentQty + qty).toString());

    // Reset calc fields
    setCalcSpent('');
    setCalcQty('');
    alert('Calculator values applied to the fields below. Click "Save" to save to Google Sheets.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const updated: Partial<Asset> = {
      AssetName: asset.AssetName,
      Balance: Number(balance),
    };

    if (asset.AssetType === 'Stocks') {
      updated.Quantity = Number(quantity);
    } else if (asset.AssetType === 'Savings') {
      updated.Extra = extra;
    }

    await onSave(updated);
    setIsSaving(false);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h3 className={styles.title}>Edit {asset.AssetName}</h3>
        
        {/* Calculator for Stock Purchases */}
        {asset.AssetType === 'Stocks' && (
          <div className={styles.calculatorSection}>
            <h4 className={styles.calcTitle}>➔ Add Purchase Calculator</h4>
            <div className={styles.calcRow}>
              <div className={styles.calcGroup}>
                <label>Amount Spent</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  value={calcSpent}
                  onChange={(e) => setCalcSpent(e.target.value)}
                />
              </div>
              <div className={styles.calcGroup}>
                <label>Shares Bought</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={calcQty}
                  onChange={(e) => setCalcQty(e.target.value)}
                />
              </div>
            </div>
            <Button 
              type="button" 
              size="sm" 
              onClick={applyCalculation}
              className={styles.calcBtn}
            >
              Apply to Fields
            </Button>
          </div>
        )}

        <form onSubmit={handleSave} className={styles.form}>
          <div className={styles.formGroup}>
            <label>
              {asset.AssetType === 'Stocks' ? 'Invested Principal' : asset.AssetType === 'Savings' ? 'Deposited Principal' : 'Current Balance'} 
              ({asset.Currency})
            </label>
            <input
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
            />
          </div>

          {asset.AssetType === 'Stocks' && (
            <div className={styles.formGroup}>
              <label>Quantity (Shares)</label>
              <input
                type="number"
                step="0.0001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
          )}

          {asset.AssetType === 'Savings' && (
            <div className={styles.formGroup}>
              <label>Annual Interest Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
