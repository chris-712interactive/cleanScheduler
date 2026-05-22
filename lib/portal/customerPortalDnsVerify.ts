import { promises as dns } from 'node:dns';
import { customerPortalVerificationRecordName } from '@/lib/portal/customerPortalHostname';

export async function verifyCustomerPortalDomainTxt(
  hostname: string,
  expectedToken: string,
): Promise<boolean> {
  const recordName = customerPortalVerificationRecordName(hostname);
  try {
    const records = await dns.resolveTxt(recordName);
    const flat = records.flat().join('');
    return flat.includes(expectedToken);
  } catch {
    return false;
  }
}
