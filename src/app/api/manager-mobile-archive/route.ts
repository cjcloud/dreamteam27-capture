import { NextResponse } from 'next/server';
import { adminDbOperations, verifyAdminRequest } from '@/lib/firebase-admin';
import { DB_PATHS } from '@/lib/constants';

// Admin-only endpoint backing the "Archive & sanitise manager mobile
// numbers" action on /mobile-archive. See docs there (and
// dreamteam27-manager's docs/SPEC-manager-app.md §11) for the full
// background: mobile numbers are collected by dreamteam27-manager for
// self-service team identity, but the shared database's read rules can't
// restrict a single field (Firebase rules cascade and can't be revoked at
// a deeper path once a shallower one grants access) — so this is a
// manually-triggered, API-gated process instead of a rules change.
//
// GET  — returns the current archive (empty if nothing's been collated yet).
// POST — collates every real (non-ADMIN) mobile number currently in /0 into
//        the archive, then overwrites those records' `mobile` field in /0
//        with the "ADMIN" placeholder. Requires { confirm: true } in the
//        body — this is a manually-initiated, one-way action (the archive
//        preserves the numbers, but /0 is changed in place) and both
//        directions are gated behind verifyAdminRequest, not just the
//        client-side AuthGuard, since API routes aren't covered by that.

const ADMIN_PLACEHOLDER = 'ADMIN';

function isAdminPlaceholder(mobile: unknown): boolean {
  return typeof mobile === 'string' && mobile.trim().toUpperCase() === ADMIN_PLACEHOLDER;
}

// /0 can come back from Firebase as either a JS array or an object keyed by
// numeric string, depending on how sparse it is — normalise to
// {index, record} pairs either way (same approach as dreamteam27-manager's
// managersDb.ts, which hit this exact issue against the same node).
function indexedRecords(raw: unknown): Array<{ index: number; record: Record<string, unknown> }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((record, index) => ({ index, record }))
      .filter((m): m is { index: number; record: Record<string, unknown> } => !!m.record);
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([key, record]) => ({ index: Number(key), record: record as Record<string, unknown> }))
      .filter((m) => Number.isInteger(m.index) && !!m.record);
  }
  return [];
}

export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized — sign in and try again.' }, { status: 401 });
  }

  try {
    const archive = (await adminDbOperations.get(DB_PATHS.MOBILE_ARCHIVE)) ?? {};
    return NextResponse.json({ archive });
  } catch (error) {
    console.error('[api/manager-mobile-archive] GET failed:', error);
    return NextResponse.json({ error: 'Failed to read archive.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized — sign in and try again.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return NextResponse.json(
        { error: 'Confirmation required — pass { confirm: true } to proceed.' },
        { status: 400 }
      );
    }

    const rawManagers = await adminDbOperations.get(DB_PATHS.MANAGERS);
    const managers = indexedRecords(rawManagers);

    // Only records with a real, non-empty, non-ADMIN mobile need archiving
    // and sanitising — everything else is left untouched.
    const toArchive = managers.filter(
      ({ record }) => typeof record.mobile === 'string' && record.mobile.trim() && !isAdminPlaceholder(record.mobile)
    );

    if (toArchive.length === 0) {
      return NextResponse.json({ archived: 0, sanitised: 0, message: 'No real mobile numbers found to archive.' });
    }

    const archivedAt = new Date().toISOString();

    // Merge into whatever's already archived (safe to run more than once —
    // re-running after new registrations only adds/updates entries, never
    // drops previously-archived ones).
    const existingArchive = (await adminDbOperations.get(DB_PATHS.MOBILE_ARCHIVE)) ?? {};
    const archiveUpdate: Record<string, unknown> = { ...existingArchive };
    for (const { index, record } of toArchive) {
      archiveUpdate[String(index)] = {
        manager: record.manager ?? record.name ?? `#${index}`,
        mobile: record.mobile,
        managerId: record.managerId ?? null,
        archivedAt,
        archivedBy: admin.email ?? admin.uid,
      };
    }
    await adminDbOperations.set(DB_PATHS.MOBILE_ARCHIVE, archiveUpdate);

    // Sanitise: overwrite just the `mobile` field on each archived record —
    // squad, points, formation, everything else is left exactly as-is.
    for (const { index } of toArchive) {
      await adminDbOperations.update(`${DB_PATHS.MANAGERS}/${index}`, { mobile: ADMIN_PLACEHOLDER });
    }

    return NextResponse.json({
      archived: toArchive.length,
      sanitised: toArchive.length,
      managers: toArchive.map(({ record }) => record.manager ?? record.name ?? 'Unknown'),
    });
  } catch (error) {
    console.error('[api/manager-mobile-archive] POST failed:', error);
    return NextResponse.json({ error: 'Archive & sanitise failed.' }, { status: 500 });
  }
}
