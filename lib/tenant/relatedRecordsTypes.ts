export interface RelatedRecordLink {
  label: string;
  detail?: string;
  href: string;
}

export interface RelatedRecordsSnapshot {
  links: RelatedRecordLink[];
}
