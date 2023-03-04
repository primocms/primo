# Primo Version 2.0.0--beta

Features: 
- ~~Block picker side panel~~
- ~~On-page editing (text, images, links)~~
- ~~Dev mode~~
- Primo Cloud landing page
- Static block fields
  - ~~Symbol gets static value~~
  - ~~New block instances get static value~~
  - ~~Store static value in symbol content~~
  - ~~Handle correct value saving when editing from page~~
  - Handle making existing fields non-static (by copying data to instances)
  - ~~Edit default value and static field values from symbol content button~~
- Save site data as db records & auto save
- Design fields
- Collaboration (lock block)

Marketing: 
- Primo Cloud service
- primocms.org landing page

Also: 
- ~~Obfuscate app classes to prevent clashing with user classes~~
- Refactor to use SvelteKit SSR features
- Consolidate HTML, CSS, JS, and Fields for Page and Site

## Need designs for
- Side panel
- On-page image & link editor UI
- primocms.org
- primocloud.io

## Considerations
- No dev mode, just dev role always shows dev options?

APIs: 
- Mailgun for emailing invitations & notifications
- OpenAI for AI content and code editing
- Supabase for db, authentication, and file storage/hosting
- Google translate for i18n translation
