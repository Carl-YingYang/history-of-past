import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const saveData = await request.json();
    
    // Upsert the save data
    await db.gameSave.upsert({
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
        lastSaveTime: saveData.lastSaveTime,
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
        lastSaveTime: saveData.lastSaveTime,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get the most recent save
    const saves = await db.gameSave.findMany({
      orderBy: { lastSaveTime: 'desc' },
      take: 1,
    });

    if (saves.length === 0) {
      return NextResponse.json(null);
    }

    const save = saves[0];
    
    // Deserialize JSON fields
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
      lastSaveTime: save.lastSaveTime,
    };

    return NextResponse.json(saveData);
  } catch (error) {
    console.error('Load error:', error);
    return NextResponse.json(null);
  }
}
