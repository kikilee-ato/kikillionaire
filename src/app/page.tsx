import FastEntryForm from '@/components/FastEntryForm';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.titleSection}>
          <h1 className={styles.appTitle}>Kikillionaire</h1>
          <p className={styles.appSubtitle}>Quick Entry</p>
        </div>
      </header>
      
      <FastEntryForm />
    </main>
  );
}
