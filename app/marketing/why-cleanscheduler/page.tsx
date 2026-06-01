import type { Metadata } from 'next';
import { SeoMarketingPage } from '@/components/marketing/SeoMarketingPage';
import { PRODUCT_NAME } from '@/lib/legal/site';
import { WHY_CLEANSCHEDULER_PAGE, buildPageMetadata } from '@/lib/marketing/seoContent';

const meta = buildPageMetadata(WHY_CLEANSCHEDULER_PAGE);

export const metadata: Metadata = {
  ...meta,
  title: `${meta.title} | ${PRODUCT_NAME}`,
};

export default function WhyCleanSchedulerPage() {
  return <SeoMarketingPage page={WHY_CLEANSCHEDULER_PAGE} />;
}
