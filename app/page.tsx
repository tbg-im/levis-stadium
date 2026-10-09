/**
 * EXAMPLE CODE — replace the contents of this file before building a real app.
 *
 * This page exists to demonstrate how to read Teambridge data and render
 * it with the design system. It is not a foundation to extend. When you
 * start building, replace this content (along with create-shift-modal.tsx
 * and actions.ts). See AGENTS.md.
 */
import Link from 'next/link';
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileEditIcon,
  InboxIcon,
  UserIcon,
} from 'lucide-react';
import { getTBContext, getTBClient, getCredentialsForAccount, TBRecordLink } from '@/lib/teambridge';
import { readIds, resolveSchema, type SchemaIssue } from '@/lib/teambridge/schema';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CreateShiftModal } from './create-shift-modal';
import { schema } from './schema';

type FilterStatus = 'all' | 'published' | 'draft';

type MappedShift = {
  id: string;
  userId: string | null;
  startAt?: string;
  endAt?: string;
  published: boolean;
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { accountId, user, userContext } = await getTBContext();
  const params = await searchParams;
  const currentFilter = (params.status as FilterStatus) || 'all';

  const credentials = getCredentialsForAccount();
  let error: string | null = null;
  let setupIssues: SchemaIssue[] = [];
  let allShifts: MappedShift[] = [];
  let totalShiftCount = 0;
  const userNames: Record<string, string> = {};
  const usersList: { id: string; name: string }[] = [];

  if (credentials) {
    try {
      // Schema discovery is account structure, so it uses the app's own
      // client and is cached per account. Records are read as the current
      // user (`userContext`), so Teambridge applies their permissions.
      const resolved = await resolveSchema(getTBClient(), schema, { cacheKey: accountId });
      setupIssues = resolved.issues.filter((issue) => issue.blocking);
      const client = getTBClient(userContext);
      const shifts = resolved.collections.shifts;
      const { start, end, assignee, published } = shifts.fields;

      if (resolved.ready && shifts.id && start && end) {
        const users = resolved.collections.users;
        const { firstName, lastName } = users.fields;
        const usersId = users.id && (firstName || lastName) ? users.id : null;

        // Both reads only need the schema, so run them together. One page is
        // enough for a demo; a real view filters server-side (e.g.
        // `filters: { [`${start.id}_gte`]: weekStart }`) and pages — see
        // AGENTS.md → "Filtering" and "Performance". The Users page feeds the
        // assignee picker; a real picker searches server-side as the user types.
        const [response, usersPage] = await Promise.all([
          client.collections.records.list(shifts.id, { page: 0, pageSize: 50 }),
          usersId ? client.collections.records.list(usersId, { page: 0, pageSize: 50 }) : null,
        ]);
        totalShiftCount = response.totalCount;
        allShifts = response.data.map((record) => {
          const rawPublished = published ? record[published.id] : undefined;
          return {
            id: record.id,
            userId: assignee ? (readIds(record[assignee.id])[0] ?? null) : null,
            startAt: record[start.id] ? String(record[start.id]) : undefined,
            endAt: record[end.id] ? String(record[end.id]) : undefined,
            published:
              typeof rawPublished === 'boolean'
                ? rawPublished
                : typeof rawPublished === 'string' && /published|active|live|yes|true/i.test(rawPublished),
          };
        });

        // Reference fields hold record ids, not names. Build an id → name map
        // from the Users collection.
        if (usersId && usersPage) {
          const nameOf = (record: Record<string, unknown>) =>
            [firstName && record[firstName.id], lastName && record[lastName.id]].filter(Boolean).join(' ').trim();

          for (const record of usersPage.data) {
            const name = nameOf(record);
            if (!name) continue;
            usersList.push({ id: record.id, name });
            userNames[record.id] = name;
          }
          usersList.sort((a, b) => a.name.localeCompare(b.name));

          // Assignees outside that page: fetch just those records, never the
          // whole Users collection.
          const missing = [...new Set(allShifts.map((shift) => shift.userId))].filter(
            (id): id is string => Boolean(id) && !userNames[id!]
          );
          const records = await Promise.all(
            missing.map((id) => client.collections.records.get(usersId, id).catch(() => null))
          );
          for (const record of records) {
            const name = record && nameOf(record);
            if (record && name) userNames[record.id] = name;
          }
        }
      }
    } catch (e) {
      // Log the full error; show something specific. This app lives inside
      // Teambridge, so never tell the user it "can't connect to Teambridge".
      console.error('[Home] loading shifts', e);
      error = "Couldn't load shifts. Try again, and if it keeps happening check the app's installation.";
    }
  }

  const publishedShifts = allShifts.filter((s) => s.published);
  const draftShifts = allShifts.filter((s) => !s.published);
  const totalCount = allShifts.length;
  const publishedCount = publishedShifts.length;
  const draftCount = draftShifts.length;

  const filteredShifts =
    currentFilter === 'published'
      ? publishedShifts
      : currentFilter === 'draft'
        ? draftShifts
        : allShifts;

  const firstName = user.name?.split(' ')[0] || user.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="bg-background">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <h1 className="text-xl font-semibold">
          {greeting}, {firstName}
        </h1>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<CalendarDaysIcon />}
            value={totalCount}
            label="Total Shifts"
            tone="warning"
          />
          <StatCard
            icon={<CheckCircle2Icon />}
            value={publishedCount}
            label="Published"
            tone="success"
          />
          <StatCard
            icon={<FileEditIcon />}
            value={draftCount}
            label="Drafts"
            tone="info"
          />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ClockIcon className="size-4 text-muted-foreground" />
              Shifts Overview
            </CardTitle>
            <CreateShiftModal users={usersList} />
          </CardHeader>

          <FilterTabs current={currentFilter} />

          <CardContent>
            {!credentials ? (
              <Alert>
                <AlertTriangleIcon />
                <AlertTitle>Configuration required</AlertTitle>
                <AlertDescription>
                  No credentials found for account{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{accountId}</code>.
                  Set <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">TB_CLIENT_ID</code> and{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">TB_CLIENT_SECRET</code> in your{' '}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.local</code>, or add
                  account-specific credentials.
                </AlertDescription>
              </Alert>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Couldn&apos;t load shifts</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : setupIssues.length > 0 ? (
              <SetupNotice issues={setupIssues} />
            ) : filteredShifts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>
                        <Assignee
                          userId={shift.userId}
                          userName={shift.userId ? userNames[shift.userId] : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        {shift.startAt ? new Date(shift.startAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        {shift.endAt ? new Date(shift.endAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge published={shift.published} />
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Opens the host's record detail panel — see AGENTS.md → "Record detail". */}
                        <TBRecordLink recordId={shift.id} className="text-sm text-primary hover:underline">
                          Open
                        </TBRecordLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState filter={currentFilter} />
            )}
          </CardContent>

          {totalShiftCount > 0 && (
            <CardFooter className="text-xs text-muted-foreground">
              Showing {filteredShifts.length} of {totalShiftCount} shifts
              {currentFilter !== 'all' && ` (filtered by ${currentFilter})`}
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserIcon className="size-4 text-muted-foreground" />
              Session Info
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">User</p>
              <p className="mt-1">{user.name || user.email || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Account ID</p>
              <p className="mt-1 font-mono">{accountId || 'No account'}</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: 'warning' | 'success' | 'info';
}) {
  const toneClasses = {
    warning: 'bg-orange-100 text-orange-600',
    success: 'bg-green-100 text-green-700',
    info: 'bg-blue-100 text-blue-700',
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-2">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-full [&>svg]:size-5',
            toneClasses,
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-xl font-medium">{value}</p>
          <p className="text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterTabs({ current }: { current: FilterStatus }) {
  return (
    <div className="border-b px-6">
      <div className="-mb-px flex gap-1">
        <FilterTab href="/" label="All" active={current === 'all'} />
        <FilterTab href="/?status=published" label="Published" active={current === 'published'} />
        <FilterTab href="/?status=draft" label="Draft" active={current === 'draft'} />
      </div>
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex items-center border-b-2 px-4 py-3 text-sm transition-colors',
        active
          ? 'border-foreground font-medium text-foreground'
          : 'border-transparent text-slate-800 hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

function Assignee({ userId, userName }: { userId: string | null; userName?: string }) {
  if (!userId) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Avatar className="size-6">
          <AvatarFallback>
            <UserIcon className="size-3.5" />
          </AvatarFallback>
        </Avatar>
        <span className="italic">Unassigned</span>
      </div>
    );
  }

  const initials = userName
    ? userName
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : null;

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarFallback className="bg-blue-100 text-xs text-blue-700">
          {initials ?? <UserIcon className="size-3.5" />}
        </AvatarFallback>
      </Avatar>
      <span>{userName || <span className="font-mono text-xs">{userId.slice(0, 8)}…</span>}</span>
    </div>
  );
}

function StatusBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Published</Badge>
  ) : (
    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Draft</Badge>
  );
}

/**
 * Shown when the account is missing collections or fields the app needs.
 * Name exactly what to add, so an admin can fix it without reading code.
 */
function SetupNotice({ issues }: { issues: SchemaIssue[] }) {
  return (
    <Alert>
      <AlertTriangleIcon />
      <AlertTitle>This app needs a few things set up</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {issues.map((issue) => (
            <li key={`${issue.collection}/${issue.field ?? ''}`}>{issue.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function EmptyState({ filter }: { filter: FilterStatus }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 rounded-full bg-muted p-3">
        <InboxIcon className="size-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {filter === 'all' ? 'No shifts found' : `No ${filter} shifts`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {filter === 'all'
          ? 'Create some shifts in Teambridge to see them here'
          : 'Try selecting a different filter'}
      </p>
    </div>
  );
}
