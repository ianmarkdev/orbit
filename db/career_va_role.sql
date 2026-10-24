-- The database role Career VA connects as. Run once as the database owner (in Neon: the role
-- that runs Career Engine's migrations), e.g.
--   psql "$OWNER_DATABASE_URL" -v password="'...'" -f db/career_va_role.sql
-- Re-run the GRANT section after a Career Engine migration adds a column this app needs.
--
-- Least privilege: the VA app can read and capture applications, move their stage, read the
-- tailored resume and answers prepared for an application, read its users' sign-in facts and
-- Sanctum token hashes, check a password, and append audit events. It cannot read the career
-- library, the answer library, AI runs, password hashes, 2FA secrets or the audit log. A tailored
-- resume is read from the frozen snapshot of the facts it uses, never from the library.

CREATE ROLE career_va LOGIN PASSWORD :password;
ALTER ROLE career_va SET statement_timeout = '15s';

GRANT USAGE ON SCHEMA public TO career_va;
REVOKE CREATE ON SCHEMA public FROM career_va;

-- Who may sign in, and their workspace.
GRANT SELECT (id, name, email, email_verified_at, two_factor_confirmed_at, is_active) ON users TO career_va;
GRANT SELECT (id, workspace_id, user_id, role) ON workspace_memberships TO career_va;
GRANT SELECT (id, workspace_id) ON candidate_profiles TO career_va;

-- Extension tokens: look up by id and hash, record use. Issuing and revoking stay in Laravel.
GRANT SELECT (id, tokenable_type, tokenable_id, token, abilities, last_used_at, expires_at) ON personal_access_tokens TO career_va;
GRANT UPDATE (last_used_at, updated_at) ON personal_access_tokens TO career_va;

-- Applications: capture (insert) and move between stages. Edits, assignment, review and delete
-- stay in Career Engine.
GRANT SELECT, INSERT ON job_applications TO career_va;
GRANT UPDATE (stage, stage_changed_at, applied_at, lock_version, updated_at) ON job_applications TO career_va;
GRANT SELECT, INSERT ON job_postings TO career_va;
GRANT INSERT ON audit_events TO career_va;

-- What the VA applies with: the tailored resume and the form answers. The app shows only the
-- approved versions; edits, AI work and approval stay in Career Engine.
GRANT SELECT (id, workspace_id, job_application_id, status, approved_version_id, approved_at) ON application_resumes TO career_va;
GRANT SELECT (id, workspace_id, application_resume_id, document, facts_snapshot) ON application_resume_versions TO career_va;
GRANT SELECT (id, workspace_id, job_application_id, origin, prompt_text, word_limit, char_limit, position) ON application_questions TO career_va;
GRANT SELECT (id, workspace_id, application_question_id, status, approved_version_id, approved_at) ON answer_drafts TO career_va;
GRANT SELECT (id, workspace_id, answer_draft_id, body) ON answer_draft_versions TO career_va;

GRANT USAGE ON SEQUENCE job_applications_id_seq, job_postings_id_seq, audit_events_id_seq TO career_va;

-- Sign-in with the Career Engine email and password. The bcrypt hash never leaves the database:
-- this runs as its owner and returns only the user id, or null. Laravel writes `$2y$` hashes;
-- pgcrypto reads the identical `$2a$` form. An unknown email still costs one bcrypt round so the
-- response time does not reveal which addresses have accounts.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION career_va_check_password(p_email text, p_password text) RETURNS bigint
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
    v_id bigint;
    v_hash text;
BEGIN
    SELECT id, password INTO v_id, v_hash FROM users WHERE lower(email) = lower(p_email) LIMIT 1;

    IF v_hash IS NULL OR v_hash !~ '^\$2[aby]\$' THEN
        PERFORM crypt(p_password, gen_salt('bf', 12));
        RETURN NULL;
    END IF;

    v_hash := '$2a$' || substr(v_hash, 5);

    RETURN CASE WHEN crypt(p_password, v_hash) = v_hash THEN v_id END;
END
$$;

REVOKE ALL ON FUNCTION career_va_check_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION career_va_check_password(text, text) TO career_va;
