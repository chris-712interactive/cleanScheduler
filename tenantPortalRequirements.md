# Tenant Portal Requirements

The tenant portal is where the individual users of a tenant will log in to handle all of the day to day activities of the cleaning business.  They can manage all of their customer's information, billing, scheduling, communications, etc.  The tenant is considered the individual cleaning business.

## User Types
For each tenant, there should be 3 basic user types: 
- Super Admins
- Administrators
- Employees

## Main Navigation Items
- Dashboard
- Quotes
- Customers
- Schedule
- Employees
- Email Campaign (if tenant has that in their subscription)
- Billing
- Settings

## Dashboard

The dashboard should be the main (root) view that the user lands on each time they log in or click the "home" button.  This view should differ slightly depending on what type of user is signed in. Below are the user types and what we can expect to see for each user type.  These will just be default settings for these users, where we will also have a section for user types that the super admins can update and make changes to if they want to.

- Super Admins
    - Super Admins should receive a Dashboard that gives them the complete, overall picture of the business in one screen.  This could include number of pending quotes in the system, number of conversions, monthly revenue, etc.
- Administrators
    - Administrators need to understand the day to day operations of the business but may not need to know how much revenue the business is making.  So this should have metrics that deal with the day to day operations of the business, but not necessarily anything else.
- Employees
    - Employees only need to see metrics that concern their own performance in the business.  This may include today's schedule, monthly income generated from jobs completed, action items, etc.

## Quotes

The quotes screen is where both the Super Admins and the Administrators with the correct permissions can view all quotes the company has received from the request state all the way through to the final decision.  This view should be an entire workflow that helps the user visualize where everything is in the different steps.  This should probably be set up similar to a Trello board where each column is a step in the quotes process.  Below would be the steps for the quotes process.

- Requests
- In Progress
- Waiting for Answer
- Final Decision

The cards for each request shoudl be able to be drag and drop between these different states.  Also, the business should be able to modify the order and the titles of these steps as well as create new steps and hide steps if they wish to do so.

## Customers

The customers view should be a card list of customers in alphanumeric order with the ability to do a text search at the top fo the page to reduce the number of options to choose from on the screen.  Once you find the customer you are looking for you can click on their card and bring up a brand new view that goes into all of the details we have saved about the customer.  This page should be viewable by Super Admins and Administrators with the designated permissions.

## Schedule

The schedule view will look different depending on the type of user who is looking at it.  Please see the information below for what the different users should see in terms of schedule.

- Super Admin
    - Super Admins should see everything that has to do with scheduling.  This should be every appointment that is set, who set the appointment, who is attending the appointment, etc.  Any and all information regarding scheduling should be seen by the Super Admin.
    - Should also be able to create any new scheduling in the system that they deem necessary.
- Administrators (with permission)
    - Administrators should be able to see all information for scheduling by default.  Depending on permissions, they may or may not be able to create new appointments on the schedule.
- Employees
    - They should be able to only see their schedule and no one else's.  Any appointment assigned directly to them they can see but nothing else.

When it comes to the scheduling view, when a user clicks on the schedule navigation, it should default to the current day's schedule as this would be the most important to any business.  All types of services should be able to be scheduled and/or adjusted from this view.

## Employees

The employees tab would be strictly for Super Admins as well as Administrators with the correct permissions.  This view would contain every single user within that business.  The information that will be stored for each employee will be as follows: 

- First Name
- Last Name
- Phone Number
- Email Address
- Picture (optional)
- Address (line 1)
- Address (line 2)
- City
- State
- ZIP Code
- Labor Cost (Optional, per hour)
- General Availability
- Permissions Assigned

I should also be able activate/deactivate employees from these views as well.

## Email Campaign

The email campaign view will server several different purposes.  This should only be able to be viewed by Super Admins or Administrators with the correct permission sets.  This view will serve as a performance dashboard for all active campaigns as well as have the ability to manage existing email campaigns or create new email campaigns from this view.  Some key metrics would be things like emails sent, open rate, click rate, etc.  As we get further into this section, I will have more details about specific integrations and how we go about implementing everything for this section.

## Billing

The billing view will handle anything that has to do with customer invoicing and payments.  This view should be given to Super Admins as well as certain administrators that have the proper permissions. They should be able to handle creating new invoices (if needed to manually), creating payments, auditing invoices and payments, etc.  This serves as the accounting hub for the business' transactions with customers and gives them all of the tools to properly assist a customer with any billing related matters.

## Settings

The settings tab will look different depending on the type of user and will be incrementally added to as we get further along in this project.  Below is a basic list of settings that we will need to implement depending on the user type:

- Super Admins
    - Personal Settings
        - Light Mode/Dark Mode
        - Preferred Email for Communications
        - Perferred Phone Number for Communications
        - Password Reset option
    - Roles
        - This will contain the ability to customize different roles to assign to employees.
        - Each role will have a set of permissions that are defined by the admin.
        - The default roles will be Admin, Billing & Employee
            - Admin
                - Will have all permissions checked by default.
            - Billing
                - Will have all read/write billing permissions checked by default.
            - Employee
                - Will have all read/write employee permissions checked by default.
    - Billing
        - This is where the super admin can update the business' credit card information as well as manage their subscription for this section.
    - Business Info
        - This will be where they can update the business' information including address, phone number and email address.
- Admins
    - Personal Settings
        - Light Mode/Dark Mode
        - Preferred Email for Communications
        - Perferred Phone Number for Communications
        - Password Reset option
    - Roles (if permissions allow)
        - This will contain the ability to customize different roles to assign to employees.
        - Each role will have a set of permissions that are defined by the admin.
        - The default roles will be Admin, Billing & Employee
            - Admin
                - Will have all permissions checked by default.
            - Billing
                - Will have all read/write billing permissions checked by default.
            - Employee
                - Will have all read/write employee permissions checked by default.
    - Billing (if permissions allow)
        - This is where the super admin can update the business' credit card information as well as manage their subscription for this section.
    - Business Info (if permissions allow)
        - This will be where they can update the business' information including address, phone number and email address.
- Employees
    - Personal Settings
        - Light Mode/Dark Mode
        - Preferred Email for Communications
        - Perferred Phone Number for Communications
        - Password Reset option
