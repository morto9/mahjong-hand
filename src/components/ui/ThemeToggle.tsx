import { useTheme } from '@/lib/useTheme';
import { Button } from './Button';

const LABEL = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
} as const;

const GLYPH = {
  system: '◐',
  light: '☀',
  dark: '☾',
} as const;

/** Cycles the theme override. Fixed to the corner of every screen. */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, cycleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className={className}
      aria-label={`Theme: ${LABEL[preference]}. Click to change.`}
      title={`Theme: ${LABEL[preference]}`}
    >
      <span aria-hidden="true">{GLYPH[preference]}</span>
      {LABEL[preference]}
    </Button>
  );
}
