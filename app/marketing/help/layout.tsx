import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      {children}
      <MarketingFooter />
    </>
  );
}
