import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`${styles.card} ${noPadding ? styles.noPadding : ''} ${className}`}>
      {children}
    </div>
  );
}
