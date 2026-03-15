// This one-time migration script has already been run.
// The _EntryTags implicit join table has been dropped and all tag
// relationships now live exclusively in TagAssignment.
// This file is kept for historical reference only — do not re-run.

console.log("migrate-entry-tags: migration already complete. _EntryTags has been removed.");
