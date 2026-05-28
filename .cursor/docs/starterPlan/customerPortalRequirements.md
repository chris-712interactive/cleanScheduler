# Customer Portal Requirements

The customer portal is for all customers of the tenant. The purpose of this portal is to give the customer any and all access to their own personal transactions with the tenant as well as any correspondence and scheduling. The customer should have the ability to request a reschedule on any appointment is currently set. There should also be an area where a customer can submit correspondence to the tenant with any questions or concerns they may have.

Below is a list of the navigation items that I would like to see on the customer portal:

- Dashboard
- Schedule
- Billing
- Messages
- Settings

## Dashboard

The dashboard for the customer should include anything the customer might want to see from their cleaning company on an occasional basis. This might include:

- Upcoming appointments scheduled
- Amount outstanding to pay
- Most Recent Invoice & Status
- Any Quotes Submitted

There may be other items that I may have not thought of yet, but this would be some of the items I was thinking of having added to the dashboard.

## Schedule

The schedule view for the customer should display a comprehensive list of upcoming appointments for the customer.

## Billing

The billing view should show the customer all invoices and payments and any outstanding balances they have with the tenant. There should be a transaction history that is easy to read and makes sense to the average person.

**Implementation note (2026-05-12):** Card collection for open balances is available from **invoice detail** on `my` (**Pay balance with card**) when the provider has completed **Stripe Connect**. **Subscriptions** enrolled by the provider appear under **Subscriptions** in the nav. **Service-plan subscription checkout** is still initiated by tenant staff from the customer record (customer self-serve subscribe-without-staff is not shipped). See `.cursor/docs/plan/implementation-plan.md` §11.6.

## Messages

The messages view is an area that allows customers to correspond with the tenant from within the application. It should allow the customer to create new conversations as well as continue existing conversations.

## Settings

The settings section will include preferences for the customer's account. This could be, but not limited to:

- Light/Dark Mode
- Contact Phone Number
- Contact Email Address
- Address
- First Name
- Last Name
- Notification Preferences
