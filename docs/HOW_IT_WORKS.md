# How EquibHub works

## Three kinds of people
| | Super Admin (platform owner) | Group leader | Member |
|---|---|---|---|
| Where the role lives | On the account | On the *membership*, per group | On the *membership*, per group |
| Create a group | Yes, and can name its leader | Anyone signed in can start one and becomes its leader | No |
| See all groups and users | Yes | Only their own groups | Only their own groups |
| Approve, add, invite, suspend, remove members | Yes | Yes, in their group | No |
| Make someone a leader, or step them down | Yes (only role that can) | No | No |
| Create monthly records | Yes | Yes | No |
| Upload a receipt | No | Yes, for their own payment | Yes, for their own payment |
| Verify or reject receipts | Yes | Yes (never their own payment) | No |
| View receipts | All | Their group's, and their own | Only their own |
| Reports (CSV, PDF) | All groups | Their group | Own history only |
| Post announcements | Yes | Yes | Read only |
| Pay for Pro | Approves payments | Submits payments | No |
| Suspend any user, activity log, stats | Yes | No | No |

One person can lead one Equb and be a plain member of another. Roles never carry across groups.

## A group's life
1. A leader creates the Equb (name, contribution, number of members). A 30-day free trial starts (one trial per person).
2. Members join by request (leader approves), by invite link (pre-approved) or by being added by email. Approval stops at the member limit.
3. Each month the leader presses "Create this month's records". Every active member gets one payment (Pending).
4. The member pays outside the app (Telebirr, CBE Birr, bank, cash), then uploads the receipt: Pending → Submitted.
5. The leader opens the receipt: Verified, or Rejected with a reason (the member can upload again).
6. If the due day passes unpaid, the record becomes Overdue. Reminders go out automatically.
7. When the trial ends, the group pauses until the leader pays for Pro (ETB 500 per month per group). The Super Admin verifies that payment and Pro starts. Nothing is ever deleted.

## Super Admin
Dashboard: totals (groups, Pro groups, members, expected, verified, awaiting review, overdue), a verified-by-month chart, and the queue of Pro payments to approve or reject. Admin page: search users, suspend or reactivate (suspension signs them out everywhere), and read the activity log of important actions.

## Setting the leader of a group
1. **At creation, by the Super Admin:** Dashboard → Create an Equb group → type the leader's email. They must already have an account.
2. **Self-service:** anyone who signs up and starts an Equb becomes its leader automatically.
3. **Later, by the Super Admin:** open the group → Members → **Make leader** (or **Make member** to step someone down). The person must be an active member. A group can have several leaders, and it always keeps at least one.
Group leaders cannot appoint or remove other leaders.
