-- Add a free-form meta column to notifications so we can deep-link to a
-- specific child resource (e.g. the wip_update_id behind a WIP notification)
-- without overloading link_id (which is a uuid and only carries the parent).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS meta jsonb;
