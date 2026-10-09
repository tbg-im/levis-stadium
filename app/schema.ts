/**
 * EXAMPLE CODE — replace with the collections and fields your app uses.
 *
 * One place that names everything the app reads or writes. Once you have run
 * the app against the real account, copy each resolved `id` in here next to
 * its `name`: pinned ids keep working when an admin renames a field, and the
 * name stays as the readable label and the fallback. See AGENTS.md → "Field
 * mapping".
 */
import { defineSchema } from '@/lib/teambridge/schema';

export const schema = defineSchema({
  shifts: {
    name: 'Shifts',
    fields: {
      start: { name: 'Start Time', type: 'DATETIME', required: true },
      end: { name: 'End Time', type: 'DATETIME', required: true },
      assignee: { name: 'Assignee' },
      published: { name: 'Published' },
    },
  },
  users: {
    name: 'Users',
    // The page still works without names — it falls back to showing ids.
    required: false,
    fields: {
      firstName: { name: 'First Name' },
      lastName: { name: 'Last Name' },
    },
  },
});
