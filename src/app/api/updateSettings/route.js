import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Setting from "@/models/settings";

export async function POST(request) {
  try {
    await connectToDatabase();

    const body = await request.json();

    // Find the first settings document or create one if it doesn't exist
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({
        isRunning: false,
        acknowledged: false,
        startedAt: new Date(),
        delayTime: 120,
        currentUser: "",
      });
    }

    // Update only the fields that are provided
    if (body.isRunning !== undefined) settings.isRunning = body.isRunning;
    if (body.acknowledged !== undefined)
      settings.acknowledged = body.acknowledged;
    if (body.startedAt) settings.startedAt = body.startedAt;
    if (body.delayTime) settings.delayTime = body.delayTime;
    if (body.currentUser !== undefined) settings.currentUser = body.currentUser;

    await settings.save();

    return NextResponse.json(
      { success: true, data: settings },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
