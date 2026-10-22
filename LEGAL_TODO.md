# Legal and privacy: what people must review

The site's privacy texts are **drafts**. Before real users sign up, a responsible adult at the
school (and, if possible, someone who knows Israeli privacy law) should go through this list.

- [ ] The contact email for data requests: `contactEmail` in `config/brand.ts` (the only contact shown on the site, on the privacy pages).
- [ ] `legal/privacy-residents.he.md`: fill in **[שם הארגון]**; check the Hebrew is plain and under 120 words.
- [ ] `legal/privacy-students.en.md`: fill in **[Organisation name]**; check every section is true for how the project really runs.
- [ ] Confirm who is the data controller (the school? the estate? a named teacher?) and who answers access/deletion requests.
- [ ] Check the retention periods (90 days after events and slots, 30 days for cancelled sign-ups, 1 year for reports, 2 years for the admin audit log).
- [ ] Check the rules for students under 18 (parent or guardian name, phone and agreement) with the school.
- [ ] Review the student code of conduct (in `lib/i18n/en.ts`, `mine.conduct`) with the school's safeguarding lead.
- [ ] Confirm the hosting and email providers listed are the ones actually used (Vercel, Supabase, Gmail/Resend, Google Calendar).
- [ ] Agree what to do in a data breach (who is told, how fast) and write the names into the notice.
- [ ] Get the school's okay before real users sign up.
- [ ] Remove the "Draft" notes from the two privacy files (the first line comment) once approved.
