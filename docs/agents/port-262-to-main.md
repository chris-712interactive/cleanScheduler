# Port #262 onto main

Learned while cherry-picking `6015b68658845d0fadeb897f99e549a9c47afeb6` (squash of #262 on `dev`) onto `origin/main` `6545fb410e4cfd631c95e8ba64cc9ec6ef85f97d`.

The isolated job checks out `main` and `workflow_dispatch` runs `.github/workflows/hosted-dev.yml` from `main`. The squash on `dev` does not change the next isolated run until this port is on `main`.

The cherry-pick had no conflicts. Hosted-dev files on `main` already matched `dev` at `adf0c2a` (the parent of the squash) because earlier ports through #261 landed the same content under different commit ids. After the cherry-pick, the #262 paths match `origin/dev` with an empty diff. Leave `platformAdminFixtureBlock`, the cookie domain, and `user_metadata` handling alone. The port only repeats the existing notes that those stay unchanged.

Do not bring the rest of `dev` along. Five test files still differ from `dev` and are outside this port: `components/theme/themeScript.test.ts`, `lib/auth/postLoginNavigation.test.ts`, `lib/auth/resolvePostLoginDestination.test.ts`, `lib/portal/inferPortalFromHost.test.ts`, and `lib/portal/platformHostLabel.test.ts`. `npm test` on this `main` tree is 798 passing tests. The 809 count on the `dev` pull request included that other `dev` work.

Do not merge the port without the owner's yes. Do not create secrets or variables, and do not dispatch the workflow. The owner adds `QA_DEV_DATABASE_URL`, `QA_RLS_USER_A_ID`, and `QA_RLS_USER_B_ID` as environment secrets on `hosted-dev-isolated` (not repository secrets). `QA_DEV_DATABASE_URL` has to be project `khodybakkdpheqkoycgi`.
