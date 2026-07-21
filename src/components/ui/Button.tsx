import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';
import { cx } from '@/lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  children: ReactNode;
}

/** The one button in the app. Variants exist so screens never restyle it ad hoc. */
export function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        styles.button,
        variant !== 'secondary' && styles[variant],
        size !== 'md' && styles[size],
        block && styles.block,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
