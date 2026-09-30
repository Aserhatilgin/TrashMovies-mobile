-- Idempotent identity/default backfill, including accounts awaiting confirmation.
-- RLS still requires an authenticated owner to read their application rows.
insert into public.profiles (id, display_name)
select u.id, private.user_domain_display_name(u.raw_user_meta_data)
from auth.users as u
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select u.id from auth.users as u
on conflict (user_id) do nothing;

-- No age, gender, self-rating, genre choices, answers, completion, or reveals
-- are inferred. No questionnaire placeholder or user_onboarding rows are needed
-- for this backfill. After finalized v1 publication, initialize_user_domain()
-- creates the current empty onboarding draft on the user's next session.
