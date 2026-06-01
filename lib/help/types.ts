export type HelpAudience =
  | 'customers'
  | 'developers'
  | 'compliance'
  | 'cleaning-businesses'
  | 'general';

export type HelpBadge = {
  label: string;
};

export type HelpCard = {
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
  badges?: HelpBadge[];
  comingSoon?: boolean;
};

export type HelpCategory = {
  slug: string;
  path: string;
  title: string;
  description: string;
  audience: HelpAudience;
  sectionTitle?: string;
  cards: HelpCard[];
};

export type HelpArticleEntry = {
  path: string;
  title: string;
  description: string;
  priority?: number;
  changeFrequency?: 'monthly' | 'yearly';
};
