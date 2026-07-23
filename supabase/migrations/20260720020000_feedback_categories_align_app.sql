-- Align feedback categories with what the app actually submits.
--
-- Root cause of "can't submit feedback": the app's new-suggestion form sends
-- category = feature | improvement | bug, but feedback_categories was seeded with
-- product-area keys (planner/focus/ada/…). createPost() runs assertCategory(),
-- which 400s ("Unknown category: feature") on every submission because the app's
-- keys don't exist in the table.
--
-- Adding the app's three keys makes submissions valid without any client change.
insert into public.feedback_categories (key, label) values
  ('feature',     'Feature'),
  ('improvement', 'Improvement'),
  ('bug',         'Bug')
on conflict (key) do nothing;
