import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import Setting from "@/models/settings";

export async function GET() {
  try {
    await connectToDatabase();

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

    return NextResponse.json(
      { success: true, data: [settings] },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    await connectToDatabase();

    const body = {
      isRunning: false,
      acknowledged: false,
      startedAt: new Date(),
      delayTime: 120,
      currentUser: "",
    };

    const newSetting = await Setting.create(body);

    return NextResponse.json(
      { success: true, data: newSetting },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating settings:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
