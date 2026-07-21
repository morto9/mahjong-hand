import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { runStore } from '@/services/gameStorage';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Injectable so tests can assert what was reported without touching console. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render crashes and offers a way out.
 *
 * A class component because `componentDidCatch` has no hook equivalent.
 *
 * The fallback is a recovery path, not an apology. The most plausible cause of a
 * crash here is a saved run this build cannot draw — a payload written by an
 * older or newer version that decodes into something unexpected. That state
 * would reload straight back into the same crash, so the fallback offers to
 * discard the run as well as to simply retry.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  private readonly handleReload = () => {
    window.location.reload();
  };

  private readonly handleDiscardRun = () => {
    runStore.clear();
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className={styles.screen}>
        <section className={styles.card} role="alert">
          <span className={styles.glyph} aria-hidden="true">
            {'\u{1F004}︎'}
          </span>

          <h1 className={styles.title}>The table tipped over</h1>

          <p className={styles.body}>
            Something broke while drawing the game. Reloading usually fixes it — but if the crash
            keeps happening, a saved run may be the cause, and discarding it will clear the way.
          </p>

          <div className={styles.actions}>
            <Button variant="primary" onClick={this.handleReload}>
              Reload
            </Button>
            <Button onClick={this.handleDiscardRun}>Discard saved run and restart</Button>
          </div>

          <details className={styles.details}>
            <summary className={styles.summary}>Technical details</summary>
            <pre className={styles.message}>{error.message || String(error)}</pre>
          </details>
        </section>
      </main>
    );
  }
}
