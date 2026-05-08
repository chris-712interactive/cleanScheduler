# Administrative Portal Requirements

The administrative portal is where all of the day to day management of tenants can be handled. This section is only available to Founder of cleanScheduler (which is me) and anyone that I deem necessary to hold administrative duties.

## Main Navigational Items

For the main navigation, I would like to see the following views: 
- Dashboard
- Inquiries
- Customers
- Integrations
- Customer Service
- Accounting
- Settings

Below, we will go through each view and what the minimum requirements for the view are.

### Dashboard

This dashboard should allow the administrators of cleanScheduler to visualize all of the key metrics that will make this software succesful in the longterm.  This would include things such as: 
- Total Active Tenants
- Total Active Inquiries
- Inquiries Converted (last 30 days)
- Total Emails Sent
- Total SMS Out
- Total SMS In
- Top 5 Active Tenants (activity includes anything the customer can do within their portal)
- Current MRR
- Revenue YTD

### Inquiries

The inquiries view should be for any company that has filled out an interest form on our non-authenticated landing pages.  These inquiries get loaded into the database for us to follow up with.  At any time if we detect that the email associated with the inquiry starts a new subscription, the inquiry should be marked "converted" so that we can keep track of conversions from these types of interactions.  We should also be able to manually update the status of an inquiry as well.  There should be filters at the top of the inquiries table so we can filter by active, converted, declined, etc.  This way we can easily keep track of everything.

### Customers

The customers view is for any active subscribing customers, customers who have started a free trial, those who started a free trial, but did not convert to a paid subscription as well as those who were on a paid subscription and now are inactive.  There should be filters so we can filter by the different statuses as well as a search filter at the top that allows us to quickly find the customer we are looking for.  If we click on the customer's row, this should open a more detailed look at that individual customer including their history with cleanScheduler, any customer service tickets, etc.

### Integrations

The integrations view should include things like SMS assignments for tenants, assignments for email for the tenants, and even billing api assignments if they are needed with Stripe.

### Customer Service

This view is specifically meant to manage any customer service ticket inquiries that come into the system from existing customers.  These could be issues with the software, questions about billing, etc.  We are going to track, reply to and handle all correspondence directly in the application so everything is saved in one place.

### Accounting

This view has to do with anything accounting related to cleanScheduler revenue as well as individual tenant's accounting summaries and so on.  We are here to facilitate easy accounting solutions for the revenue that is generated while using our software so that tenants can easily take that to their accountant for tax purposes.

### Settings

The settings view would have to deal with settings for the entire application as well as those that apply to just tenants or just customers.  This section will be a work in progress as we figure out what settings we actually need for this section.