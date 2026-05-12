import { Button } from '@/components/ui/Button';
import { endMasqueradeAction } from '@/lib/admin/masqueradeActions';
import styles from './MasqueradeExitBanner.module.scss';

export function MasqueradeExitBanner() {
  return (
    <form action={endMasqueradeAction} className={styles.form}>
      <span>You are viewing this workspace as platform staff (masquerade).</span>
      <Button type="submit" variant="secondary" size="sm">
        Exit to founder admin
      </Button>
    </form>
  );
}
