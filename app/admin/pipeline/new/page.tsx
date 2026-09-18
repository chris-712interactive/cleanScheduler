import { PageHeader } from '@/components/portal/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { createSalesLeadAction } from '@/lib/admin/salesActions';
import styles from '../pipeline.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewSalesLeadPage({ searchParams }: PageProps) {
  await requirePortalAccess('admin', '/pipeline/new');
  const sp = await searchParams;
  const err = typeof sp.error === 'string' ? sp.error : undefined;

  return (
    <>
      <PageHeader
        title="New lead"
        description="Add a prospect you reached out to or who requested a demo."
      />
      {err ? <Alert variant="danger">{err}</Alert> : null}
      <Card>
        <form action={createSalesLeadAction}>
          <div className={styles.formGrid}>
            <FormField label="Business name" htmlFor="businessName">
              <Input id="businessName" name="businessName" required />
            </FormField>
            <FormField label="Owner name" htmlFor="ownerName" optional>
              <Input id="ownerName" name="ownerName" />
            </FormField>
            <FormField label="Email" htmlFor="email" optional>
              <Input id="email" name="email" type="email" />
            </FormField>
            <FormField label="Phone" htmlFor="phone" optional>
              <Input id="phone" name="phone" />
            </FormField>
            <FormField label="Website" htmlFor="website" optional>
              <Input id="website" name="website" />
            </FormField>
            <FormField label="City" htmlFor="city" optional>
              <Input id="city" name="city" />
            </FormField>
            <FormField label="County" htmlFor="county" optional>
              <Input id="county" name="county" />
            </FormField>
            <FormField label="State" htmlFor="state" optional>
              <Input id="state" name="state" maxLength={2} placeholder="FL" />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="notes" optional>
            <Textarea id="notes" name="notes" rows={4} />
          </FormField>
          <label className={styles.muted}>
            <input type="checkbox" name="assignToSelf" defaultChecked /> Assign to me
          </label>
          <div className={styles.actions}>
            <Button type="submit" variant="primary">
              Save lead
            </Button>
            <Button as="a" href="/pipeline" variant="secondary">
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
