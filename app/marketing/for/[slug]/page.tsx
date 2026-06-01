import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SeoMarketingPage } from '@/components/marketing/SeoMarketingPage';
import { PRODUCT_NAME } from '@/lib/legal/site';
import {
  FOR_PAGES,
  buildPageMetadata,
  getSeoMarketingPageBySlug,
} from '@/lib/marketing/seoContent';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return FOR_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoMarketingPageBySlug('for', slug);
  if (!page) return { title: PRODUCT_NAME };
  const meta = buildPageMetadata(page);
  return { ...meta, title: `${meta.title} | ${PRODUCT_NAME}` };
}

export default async function ForSegmentPage({ params }: PageProps) {
  const { slug } = await params;
  const page = getSeoMarketingPageBySlug('for', slug);
  if (!page) notFound();
  return <SeoMarketingPage page={page} />;
}
