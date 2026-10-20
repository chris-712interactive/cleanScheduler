import type { Metadata } from 'next';
import { SeoMarketingPage } from '@/components/marketing/SeoMarketingPage';
import { WHY_CLEANSCHEDULER_PAGE, buildPageMetadata } from '@/lib/marketing/seoContent';

export const metadata: Metadata = buildPageMetadata(WHY_CLEANSCHEDULER_PAGE);

export default function WhyCleanSchedulerPage() {
  return <SeoMarketingPage page={WHY_CLEANSCHEDULER_PAGE} />;
}
