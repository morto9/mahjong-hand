import { useSound } from '@/lib/useSound';
import { Button } from './Button';

/** Mutes and unmutes the game's synthesised sound. */
export function SoundToggle({ className }: { className?: string }) {
  const { muted, toggleMuted } = useSound();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleMuted}
      className={className}
      aria-pressed={!muted}
      aria-label={muted ? 'Sound off. Click to unmute.' : 'Sound on. Click to mute.'}
      title={muted ? 'Sound off' : 'Sound on'}
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
      {muted ? 'Muted' : 'Sound'}
    </Button>
  );
}
