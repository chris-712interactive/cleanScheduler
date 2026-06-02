/** User-facing explanation when auto-scheduling did not create visits. */
export function autoScheduleSkippedMessage(reason: string | undefined): string {
  switch (reason) {
    case 'no_lines_flagged':
      return 'No service lines were flagged for auto-schedule on this quote.';
    case 'missing_customer':
      return 'This quote has no customer linked, so visits could not be created.';
    case 'tenant_not_found':
      return 'Workspace settings could not be loaded.';
    case 'line_items_load_failed':
      return 'Could not read quote line items. If you recently deployed, apply database migration 0058 (quote line auto-schedule).';
    case 'visit_create_failed':
      return 'Visits could not be saved. Apply migrations 0058 and 0059 (auto-schedule and staffing), then try again.';
    case 'auto_schedule_disabled':
      return 'Automatic scheduling is turned off in Operations settings. Enable it there, or schedule visits manually.';
    default:
      return 'Visits were not created automatically. Try again or schedule manually.';
  }
}
