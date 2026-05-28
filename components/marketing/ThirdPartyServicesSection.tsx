import {
  ACTIVE_THIRD_PARTY_SERVICES,
  PLANNED_THIRD_PARTY_SERVICES,
  type ThirdPartyService,
} from '@/lib/legal/thirdPartyServices';
import styles from '@/app/marketing/legal.module.scss';

function ServiceRows({ services }: { services: ThirdPartyService[] }) {
  return (
    <>
      {services.map((service) => (
        <tr key={service.name}>
          <th scope="row">{service.name}</th>
          <td>{service.purpose}</td>
          <td>{service.dataShared}</td>
          <td>
            <a href={service.privacyPolicyUrl} rel="noopener noreferrer" target="_blank">
              {service.name} privacy policy
            </a>
          </td>
        </tr>
      ))}
    </>
  );
}

export function ThirdPartyServicesSection() {
  return (
    <>
      <table className={styles.thirdPartyTable}>
        <caption>Sub-processors and infrastructure providers currently in use</caption>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Role</th>
            <th scope="col">Data involved</th>
            <th scope="col">Their policy</th>
          </tr>
        </thead>
        <tbody>
          <ServiceRows services={ACTIVE_THIRD_PARTY_SERVICES} />
        </tbody>
      </table>

      <p className={styles.plannedNote}>
        We may enable additional providers as features ship. The following are configured in our
        environment but not yet called from production application code; we will update this page
        before they process your data:
      </p>

      <table className={styles.thirdPartyTable}>
        <caption>Planned providers (not yet active in the application)</caption>
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Intended role</th>
            <th scope="col">Data involved</th>
            <th scope="col">Their policy</th>
          </tr>
        </thead>
        <tbody>
          <ServiceRows services={PLANNED_THIRD_PARTY_SERVICES} />
        </tbody>
      </table>

      <p>
        <strong>Tenant payment processing.</strong> When a cleaning business connects Stripe
        Connect, card and bank payments for that business&apos;s customers are processed by Stripe
        under that business&apos;s Stripe account. cleanScheduler receives payment status, amounts,
        and dispute notifications to operate invoicing and reporting; Stripe&apos;s handling of
        cardholder data is governed by Stripe&apos;s policies and the tenant&apos;s agreement with
        Stripe.
      </p>

      <p>
        <strong>Authentication email.</strong> Depending on workspace settings, account confirmation
        or password-reset messages may be sent by Supabase Auth rather than Resend. Those messages
        are limited to account verification flows.
      </p>
    </>
  );
}
