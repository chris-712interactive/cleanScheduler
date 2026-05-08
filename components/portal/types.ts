export interface NavItem {
  label: string;
  href: string;
  icon: string;

  // Optional badge - useful for "Inbox (3 new)" kinds of indicators.
  badge?: string | number;

  // When true, this item only matches its href exactly (no descendant match).
  exact?: boolean;
}

export interface IdentityChipModel {
  name: string;
  subtitle?: string;
  // Initials shown when no avatar is provided.
  initials?: string;
  avatarUrl?: string;
}
