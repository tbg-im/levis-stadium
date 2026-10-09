'use server';

/**
 * EXAMPLE CODE — replace or remove before building a real app. See AGENTS.md.
 */
import { getTBContext, getTBClient, TBApiError } from '@/lib/teambridge';
import { resolveSchema, toWriteValue } from '@/lib/teambridge/schema';
import { schema } from './schema';

export async function createShift(formData: FormData) {
  // Already ISO strings with a timezone — the modal converts them in the browser.
  const startTime = formData.get('startTime') as string | null;
  const endTime = formData.get('endTime') as string | null;
  const assignee = (formData.get('assignee') as string | null)?.trim() || null;
  if (!startTime || !endTime) {
    return { error: 'Start time and end time are required.' };
  }

  if (new Date(endTime) <= new Date(startTime)) {
    return { error: 'End time must be after start time.' };
  }

  const { accountId, userContext } = await getTBContext();

  try {
    const resolved = await resolveSchema(getTBClient(), schema, { cacheKey: accountId });
    const shifts = resolved.collections.shifts;
    const { start, end, assignee: assigneeField } = shifts.fields;
    if (!resolved.ready || !shifts.id || !start || !end) {
      return { error: "Can't create shifts yet: the Shifts collection is missing fields this app needs." };
    }

    // Write as the current user, so Teambridge applies their permissions.
    const client = getTBClient(userContext);
    const recordData: Record<string, unknown> = {
      [start.id]: toWriteValue(start, startTime),
      [end.id]: toWriteValue(end, endTime),
    };
    if (assignee && assigneeField && !assigneeField.readOnly) {
      recordData[assigneeField.id] = toWriteValue(assigneeField, assignee);
    }

    await client.collections.records.create(shifts.id, recordData);
    return { success: true };
  } catch (e) {
    // Log the full error for debugging; show the user something specific.
    console.error('[createShift]', e);
    if (e instanceof TBApiError && e.status === 403) {
      return { error: "You don't have permission to create shifts." };
    }
    return { error: "Couldn't save the shift. Check the values and try again." };
  }
}
