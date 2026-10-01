# Google Play: app content answers

What to answer in Play Console → Policy and programs → App content. Based on
what the app sends today; check it again when the app starts collecting
something new.

## Data safety

**Does your app collect or share any of the required user data types?** Yes.

**Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS only).

**Which of the following methods of account creation does your app support?**
OAuth (Sign in with Google).

**Delete account URL:** https://diuqbank.com/delete-account (https://ourdiu.com/delete-account after the cutover in docs/PLAN.md)

**Do you provide a way for users to request that some or all of their data is
deleted, without requiring them to delete their account?** Yes: withdrawing an
upload that isn't published yet, and undoing a like or dislike, both in the app. (Answer No if you'd rather not promise it.)

### Data types

Nothing is **shared** in Play's sense: Cloudflare, Google (sign-in, Gemini) and the PDF service are service providers acting on your behalf,
and a published paper showing your name is something you chose to do.

| Category | Data type | Collected | Required? | Purposes |
| --- | --- | --- | --- | --- |
| Personal info | Name | Yes | Optional (only when signing in) | App functionality, Account management |
| Personal info | Email address | Yes | Optional | App functionality, Account management |
| Personal info | User IDs | Yes (Google account ID, username) | Optional | App functionality, Account management |
| Personal info | Other info | Yes (profile photo from Google) | Optional | App functionality, Account management |
| Files and docs | Files and docs | Yes (PDFs you upload) | Optional | App functionality |
| App activity | App interactions | Yes (likes, dislikes, reports) | Optional | App functionality |
| App activity | Other user-generated content | Yes (a report's note) | Optional | App functionality |

Everything above is **not processed ephemerally** (it's stored).

**Not collected:** location, contacts, photos and videos (a camera scan becomes
the PDF you upload, which is under Files and docs; nothing else leaves the
phone), audio, calendar, messages, health, financial info, web browsing, and
installed apps, crash logs and diagnostics (the app has no crash reporter or
analytics yet; add them here when it does). "Send feedback" puts the app version
and phone model in an email the user sends from their own mail app, which Play
doesn't count as collection. Saved papers, recent courses and the theme stay on the phone and
aren't "collected" (Play only counts data sent off the device).

## App access

**All or some functionality is restricted.** Instructions for reviewers:

> Browsing, searching, reading, saving and sharing papers work without an
> account. Signing in (Account tab → Continue with Google) works with any
> Google account and is needed to like or report a paper. Sharing a paper also
> needs a Daffodil International University (@diu.edu.bd) Google account.

Play reviewers can sign in, but without a DIU account they can't upload. Play
may accept the instructions as they are; if it rejects the review over access,
the fix is to let one reviewer address contribute (an allowlist in
`canContribute`, `packages/shared/src/constants.ts`) and give that address here.

## Ads

No, the app doesn't contain ads.

## Content rating

Questionnaire category: **Reference, News, or Educational**. Answers:
- Violence, sexuality, language, controlled substances, gambling: No.
- **Users can interact or exchange content:** Yes. Students upload papers that
  others can read. Uploads are checked (an AI check, then admin review) and can
  be reported from the paper's menu.
- Shares the user's location: No. Digital purchases: No.

## Target audience

**18 and over.** It's for university students; choosing only 18+ keeps the app
out of Play's Families policy requirements.

## News app / COVID-19 / Government app / Financial features / Health

No to each.
