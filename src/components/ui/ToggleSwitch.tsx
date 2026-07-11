'use client';

import React from 'react';
import styles from './ToggleSwitch.module.css';

interface ToggleSwitchProps {
  isOn: boolean;
  onToggle: (isOn: boolean) => void;
  labelLeft?: string;
  labelRight?: string;
}

export function ToggleSwitch({ isOn, onToggle, labelLeft, labelRight }: ToggleSwitchProps) {
  return (
    <div className={styles.toggleContainer} onClick={() => onToggle(!isOn)}>
      {labelLeft && <span className={`${styles.label} ${!isOn ? styles.active : ''}`}>{labelLeft}</span>}
      <div className={`${styles.switch} ${isOn ? styles.switchOn : ''}`}>
        <div className={styles.thumb} />
      </div>
      {labelRight && <span className={`${styles.label} ${isOn ? styles.active : ''}`}>{labelRight}</span>}
    </div>
  );
}
