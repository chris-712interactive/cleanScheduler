# Clean Scheduler Project Details

The following information is to be used for planning and development purposes of the Clean Scheduler application. At any time during the development process, if there are questions that arise, you are to stop developing and ask those questions to properly fill in information gaps.

## What is Clean Scheduler?

Clean Scheduler is a multi-tenant, one stop shop for any scheduling, quoting, billing and customer service needs of a Residential or Commercial Cleaning business. This software is not meant for any other niche except that of Residential and Commercial Cleaning Companies.

## Goal of Clean Scheduler

This software is meant to fill all of the gaps and issues Residential or Commercial Cleaning businesses have with current software on the market such as Jobber. Once this software is operational, all Residential or Commercial Cleaning businesses will only want to use this software to manage their day to day business. The software should be as operationally lean as possible while still maintaining high standards for the end user.

## Preferred Tech Stack

For my current projects I have been utilizing Next.js (with React & Redux Toolkit) for the frontend and a Supabase backend. I would like you to explore all options and determine what would be most suited for a multi-tenant setup such as this and report back with findings on the pros and cons of each option.

## Security Concerns

Because we are dealing with other tenant's customer information, there needs to be a level of encryption that happens with this type of information. I would like suggestions on what type of encryption and where this would be the most appropriate.

## Business Requirements

The following list of requirements are the bare minimum that this software must have to be considered operational. Along the way, if you deem something to be of value, that should be added, please recommend those upgrades and I will deicde if they are worthy to be added or not.

### 1. Administrative Portal

The administrative portal is where the admin for Clean Scheduler as an whole product should be able to manage the day to day maintanence of the application as a whole. More details on the Administrative Portal can be found on the administrativePortalRequirements.md document.

### 2. Onboarding Tenants

A tenant (or business) is someone whow is looking to utilize the Clean Scheduler software. I should be able to as an Administrator of Clean Scheduler manage the day to day activities that are associated taking care of the software. This would include being able to manually onboard a new tenant, modify the subscription of an existing tenant, manually deactivate an existing tenant, with the tenant's permission, launch into an existing tenant's account to perform customer service duties such as helping them set up a new team member/customer (limited time access). There are probably some other administrative duties I should be able to perform, but this is the first step before any other pieces of the puzzle get completed.

The other side to onboarding tenants will be the automatic side. We should have the ability of activating a 7-day free trial automatically for the customer upon request from the website, the tenant should also be able to activate a subscription plan on their own as well with automated steps that gathers all necessary pieces of information from them.

### 3. Tenant Portal

Once a tenant has successfully onboarded, they should be brought to their tenant portal where all of their day to day activities will be handled. You can find more details about the tenant portal in the tenantPortalRequirements.md documentation.

### 4. Customer Portal

Customers will have access to manage their customer account once a tenant has added them. A customer may be added to more than 1 tenant as it is possible that a customer may split their services among multiple businesses. To the customer though, there should be a single portal where they can see it all. You can gather more information about the customer portal throught he customerPortalRequirements.md documentation.

### 5. Customer billing (tenant → customer)

**MVP (2026-05-12):** Tenants record **manual** payments on **customer invoices** and, after **Stripe Connect Express** onboarding (`/billing/payment-setup`), can collect **card** payments via **Stripe Checkout** on the connected account (staff on invoice detail, or the customer on **`my`** invoice detail). **Service plans** + **subscription Checkout** on Connect cover recurring customer charges from the customer record; the **customer portal** lists **subscriptions** after webhooks sync. Remaining roadmap items (RRULE visit generator, Billing Portal, check workflow, full fee backfill) are tracked in `.cursor/docs/plan/implementation-plan.md` §11.6 and the YAML `billingPlans` / `paymentFlowsImpl` / `recurringBilling` entries in that file.
