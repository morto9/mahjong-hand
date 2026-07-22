import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';
import { cx } from '@/lib/cx';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  /** Small-caps label rendered in the panel header. */
  title?: string;
  /** Optional control aligned to the right of the title. */
  action?: ReactNode;
  raised?: boolean;
  flush?: boolean;
  /**
   * Absorbs the leftover height of a flex column, letting its content scroll
   * internally rather than growing the page.
   */
  fill?: boolean;
  as?: 'section' | 'aside' | 'div';
  children: ReactNode;
}

/** Standard bordered surface. Every boxed region in the app uses one. */
export function Panel({
  title,
  action,
  raised = false,
  flush = false,
  fill = false,
  as: Tag = 'section',
  className,
  children,
  ...rest
}: PanelProps) {
  return (
    <Tag
      className={cx(
        styles.panel,
        raised && styles.raised,
        flush && styles.flush,
        fill && styles.fill,
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
