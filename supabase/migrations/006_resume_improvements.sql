ALTER TABLE resumes ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Set the most recently uploaded resume as the initial default
UPDATE resumes
SET is_default = true
WHERE id = (SELECT id FROM resumes ORDER BY created_at DESC LIMIT 1);
