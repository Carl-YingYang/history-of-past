import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper: gracefully disconnect & re-create the Prisma client on connection errors.
// SQLite in dev sandboxes can return "attempt to write a readonly database" if the
// underlying file handle becomes stale (e.g. after the file is touched externally).
// We catch the error, disconnect, and let the next request build a fresh client.
async function withDbResilience<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    // Log once, then attempt a graceful disconnect so the next request can reconnect.
    console.warn('DB operation failed — falling back to localStorage-only save:', 
      error instanceof Error ? error.message : String(error));
    try {
      await db.$disconnect();
    } catch {
      // ignore disconnect errors
    }
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const saveData = await request.json();

    // lastSaveTime is stored as Int (seconds since epoch) to fit SQLite's Int range.
    // The client sends milliseconds — convert to seconds.
    const lastSaveTimeMs = saveData.lastSaveTime ?? Date.now();
    const lastSaveTime = Math.floor(Number(lastSaveTimeMs) / 1000);

    // Upsert the save data — resilient to DB connection issues
    const result = await withDbResilience(() => db.gameSave.upsert({
      where: { playerId: saveData.playerId },
      update: {
        currentChapter: saveData.currentChapter,
        completedObjectives: JSON.stringify(saveData.completedObjectives),
        completedQuests: JSON.stringify(saveData.completedQuests),
        unlockedCodex: JSON.stringify(saveData.unlockedCodexEntries),
        journalEntries: JSON.stringify(saveData.journalEntries),
        xp: saveData.xp,
        chapterMedals: JSON.stringify(saveData.chapterMedals),
        gameState: JSON.stringify(saveData.gameState),
        lastSaveTime,
      },
      create: {
        playerId: saveData.playerId,
        currentChapter: saveData.currentChapter,
        completedObjectives: JSON.stringify(saveData.completedObjectives),
        completedQuests: JSON.stringify(saveData.completedQuests),
        unlockedCodex: JSON.stringify(saveData.unlockedCodexEntries),
        journalEntries: JSON.stringify(saveData.journalEntries),
        xp: saveData.xp,
        chapterMedals: JSON.stringify(saveData.chapterMedals),
        gameState: JSON.stringify(saveData.gameState),
        lastSaveTime,
      },
    }));

    // Even if the server-side save fails, the client already persisted to localStorage,
    // so we return success to avoid confusing error UI. We log the failure above.
    if (result === null) {
      return NextResponse.json({ success: true, persisted: false, reason: 'db-unavailable' });
    }

    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error('Save route error:', error);
    // Still return 200 to avoid breaking the game UX — localStorage is the source of truth.
    return NextResponse.json({ success: true, persisted: false, reason: 'route-error' });
  }
}

export async function GET() {
  try {
    // Get the most recent save — resilient to DB issues
    const saves = await withDbResilience(() => db.gameSave.findMany({
      orderBy: { lastSaveTime: 'desc' },
      take: 1,
    }));

    if (!saves || saves.length === 0) {
      return NextResponse.json(null);
    }

    const save = saves[0];

    // Deserialize JSON fields. Convert seconds back to milliseconds for client.
    const saveData = {
      playerId: save.playerId,
      currentChapter: save.currentChapter,
      completedObjectives: JSON.parse(save.completedObjectives),
      completedQuests: JSON.parse(save.completedQuests),
      unlockedCodexEntries: JSON.parse(save.unlockedCodex),
      journalEntries: JSON.parse(save.journalEntries),
      xp: save.xp,
      chapterMedals: JSON.parse(save.chapterMedals),
      gameState: JSON.parse(save.gameState),
      lastSaveTime: save.lastSaveTime * 1000,
    };

    return NextResponse.json(saveData);
  } catch (error) {
    console.warn('Load error (client will fall back to localStorage):', 
      error instanceof Error ? error.message : String(error));
    return NextResponse.json(null);
  }
}

export async function DELETE() {
  try {
    // Delete all save data (for reset progress feature)
    const result = await withDbResilience(() => db.gameSave.deleteMany({}));
    if (result === null) {
      // DB unavailable — still return success so the client-side reset (localStorage) completes.
      return NextResponse.json({ success: true, persisted: false });
    }
    return NextResponse.json({ success: true, persisted: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ success: true, persisted: false });
  }
}
