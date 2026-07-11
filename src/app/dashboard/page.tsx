'use client';

import React, { useEffect, useState, useCallback } from 'react';
import styles from '../page.module.css';
import { Card } from '@/components/ui/Card';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import AssetEditModal from '@/components/AssetEditModal';
import { Asset } from '@/lib/googleSheets';

interface DashboardData {
  eurToKrw: number;
  assets: (Asset & { accruedInterest?: number; stockProfit?: number })[];
  metrics: {
    availableAssetsEUR: number;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [currency, setCurrency] = useState<'EUR' | 'KRW'>('EUR');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const toggleCurrency = (isOn: boolean) => {
    setCurrency(isOn ? 'KRW' : 'EUR');
  };

  const formatAssetCurrency = (balance: number, assetCurrency: 'EUR' | 'KRW') => {
    if (!data) return '';
    if (currency === 'EUR') {
      const valueEUR = assetCurrency === 'KRW' ? balance / data.eurToKrw : balance;
      return `€ ${valueEUR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      const valueKRW = assetCurrency === 'EUR' ? balance * data.eurToKrw : balance;
      return `₩ ${Math.round(valueKRW).toLocaleString()}`;
    }
  };

  const handleAssetClick = (asset: Asset) => {
    setSelectedAsset(asset);
    setIsModalOpen(true);
  };

  const handleSaveAsset = async (updatedData: Partial<Asset>) => {
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        alert('Asset updated successfully.');
        fetchDashboard();
      } else {
        const err = await res.json();
        alert(`Failed to update asset: ${err.error}`);
      }
    } catch (error) {
      alert(`Error updating asset: ${error}`);
    }
  };

  if (isLoading && !data) {
    return <div className={styles.loading}>Loading Assets...</div>;
  }

  const eurToKrw = data?.eurToKrw || 1450;
  const assets = data?.assets || [];
  const availableAssets = assets.filter(a => a.AssetType !== 'Savings' && a.AssetType !== 'Stocks');
  const nonAvailableAssets = assets.filter(a => a.AssetType === 'Savings' || a.AssetType === 'Stocks');

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.appTitle}>Assets</h1>
          <p className={styles.appSubtitle}>Manage your funds</p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.exchangeRate}>
            1 EUR = {Math.round(eurToKrw).toLocaleString()} KRW
          </div>
          <ToggleSwitch 
            isOn={currency === 'KRW'} 
            onToggle={toggleCurrency} 
            labelLeft="EUR" 
            labelRight="KRW" 
          />
        </div>
      </header>

      {/* Assets Section */}
      <section className={styles.assetsSection}>
        <div className={styles.assetGroup}>
          <h3 className={styles.groupTitle}>Available Assets</h3>
          {availableAssets.map((asset, i) => (
            <div 
              key={i} 
              className={`${styles.assetItem} ${styles.clickable}`}
              onClick={() => handleAssetClick(asset)}
            >
              <div>
                <span className={styles.assetName}>{asset.AssetName}</span>
                <span className={styles.assetTag}>{asset.AssetType}</span>
              </div>
              <span className={styles.assetValue}>
                {formatAssetCurrency(asset.Balance, asset.Currency)}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.assetGroup}>
          <h3 className={styles.groupTitle}>Non-Available Assets</h3>
          {nonAvailableAssets.map((asset, i) => (
            <div 
              key={i} 
              className={`${styles.assetItem} ${styles.clickable}`}
              onClick={() => handleAssetClick(asset)}
            >
              <div>
                <span className={styles.assetName}>{asset.AssetName}</span>
                <span className={styles.assetTag}>{asset.AssetType}</span>
                {asset.AssetType === 'Savings' && asset.accruedInterest !== undefined && (
                  <div className={styles.assetExtraInfo}>
                    Interest: +{formatAssetCurrency(asset.accruedInterest, asset.Currency)}
                  </div>
                )}
                {asset.AssetType === 'Stocks' && asset.stockProfit !== undefined && (
                  <div className={styles.assetExtraInfo}>
                    Profit: {asset.stockProfit >= 0 ? '+' : ''}{formatAssetCurrency(asset.stockProfit, asset.Currency)}
                  </div>
                )}
              </div>
              <span className={styles.assetValue}>
                {formatAssetCurrency(asset.Balance, asset.Currency)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <AssetEditModal
        asset={selectedAsset}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveAsset}
      />
    </main>
  );
}
