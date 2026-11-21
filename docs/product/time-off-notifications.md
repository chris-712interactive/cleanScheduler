# Time off notifications

Owners and admins (the office roles that can approve time off) are emailed when a team member submits a request. The message is from Clean Scheduler and links to `/schedule/time-off-requests`. See `docs/product/email-branding.md`.

The person who submitted the request is not emailed about their own request. If no other owner or admin has a login email, the workspace owner or company email is used instead, unless that address is the requester.

Approving a request looks up scheduled jobs assigned to that person whose times overlap the approved window. When any exist:

- The approval confirmation tells the reviewer how many jobs still need a new time.
- Owners and admins get an email listing each overlapping job, with a link to the visit and to Schedule → Issues.
- Those visits stay on the Issues list with a **Time off overlap** badge until the job is moved, reassigned, completed, or canceled.

Denying a request does not send a conflict email. The person who requested the time off gets one email when it is approved or denied. That message is from Clean Scheduler and links to `/schedule/time-off`. The address is their login email. An inactive membership, a missing login email, or an address on that workspace's email suppression list skips it. The office is not copied on that decision.

Email is skipped when Resend is not configured. `OUTBOUND_SUPPRESSED=1` logs the skip and does not call Resend. The dashboard pending count and Issues list still update.

The team member page (`/employees/[userId]`) shows that person's week: assigned jobs, approved time off, and pending requests. Pending time off uses a dotted outline and links to the review queue. Approved time off uses a solid tint. Previous and next week move the board, and a note appears when more time off falls outside the visible week.
