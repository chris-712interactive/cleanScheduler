import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { findCatalogEntry, loadJobTypeCatalog } from '@/lib/tenant/jobTypeCatalog';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import type { ParsedQuoteLineItem } from '@/lib/tenant/quoteLineItemsForm';

type Admin = SupabaseClient<Database>;

/** Resolves quote line labels from the job type catalog and optional display titles. */
export async function enrichParsedQuoteLines(
  admin: Admin,
  tenantId: string,
  propertyKind: CustomerPropertyKind | null,
  lines: ParsedQuoteLineItem[],
): Promise<{ lines: ParsedQuoteLineItem[] } | { error: string }> {
  const catalog = await loadJobTypeCatalog(admin, tenantId, {
    propertyKind,
    activeOnly: false,
  });

  const enriched: ParsedQuoteLineItem[] = [];

  for (const line of lines) {
    if (line.service_template_id) {
      const entry = catalog.find((row) => row.id === line.service_template_id);
      if (!entry) {
        return {
          error: 'A selected job type is no longer available. Refresh the page and try again.',
        };
      }
      const display_title = line.display_title?.trim() || null;
      enriched.push({
        ...line,
        display_title,
        service_label: display_title || entry.service_label || entry.name,
      });
      continue;
    }

    if (!line.service_label.trim()) {
      return { error: 'Select a job type for each service line.' };
    }

    const matched = findCatalogEntry(catalog, {
      serviceLabel: line.service_label,
      propertyKind,
    });
    enriched.push({
      ...line,
      display_title: line.display_title?.trim() || null,
      service_template_id: matched?.id ?? line.service_template_id,
    });
  }

  return { lines: enriched };
}
