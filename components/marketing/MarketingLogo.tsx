import Image from 'next/image';
import Link from 'next/link';
import styles from './MarketingLogo.module.scss';

interface MarketingLogoProps {
  href?: string;
  className?: string;
}

export function MarketingLogo({ href = '/', className }: MarketingLogoProps) {
  const content = (
    <>
      <Image
        src="/brand/logo.svg"
        alt=""
        width={28}
        height={28}
        className={styles.logoMark}
        aria-hidden
      />
      <span className={styles.logoText}>cleanScheduler</span>
    </>
  );

  const rootClass = [styles.logo, className].filter(Boolean).join(' ');

  if (href) {
    return (
      <Link href={href} className={rootClass}>
        {content}
      </Link>
    );
  }

  return <span className={rootClass}>{content}</span>;
}
