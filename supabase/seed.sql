-- Starter content. Run once after the migrations (Supabase → SQL Editor).
-- Everything here can be edited later in /admin. The language list lives in config/languages.ts.

insert into lesson_topics (name_en, name_he, sort) values
  ('English conversation', 'שיחה באנגלית', 1),
  ('Using a smartphone', 'שימוש בסמארטפון', 2),
  ('Computer basics', 'מחשב למתחילים', 3),
  ('Mathematics', 'מתמטיקה', 4),
  ('Music', 'מוזיקה', 5),
  ('Art and drawing', 'אמנות וציור', 6),
  ('History', 'היסטוריה', 7),
  ('Cooking', 'בישול', 8);

insert into courses (title_en, title_he, description_en, description_he, sort) values
  ('English conversation club', 'חוג שיחה באנגלית', 'Relaxed conversation practice with students.', 'תרגול שיחה נינוח עם תלמידים.', 1),
  ('Digital skills', 'מיומנויות דיגיטליות', 'Phone, WhatsApp, email and online services.', 'טלפון, וואטסאפ, מייל ושירותים באינטרנט.', 2),
  ('Music appreciation', 'האזנה למוזיקה', 'Listening and talking about music from around the world.', 'האזנה ושיחה על מוזיקה מכל העולם.', 3);

insert into timetable_slots (day, start_time, end_time, title_en, title_he, location_en, location_he) values
  (0, '16:00', '17:00', 'English conversation club', 'חוג שיחה באנגלית', 'Main hall', 'האולם המרכזי'),
  (2, '16:30', '17:30', 'Digital skills', 'מיומנויות דיגיטליות', 'Library', 'הספרייה');
