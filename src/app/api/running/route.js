import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import Setting from "@/models/settings";

export async function GET() {
  try {
    await connectToDatabase();

    const settings = await Setting.find();

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

export async function POST() {
  try {
    await connectToDatabase();

    const body = {
      isRunning: false,
      acknowledged: false,
      lastRun: new Date(),
    };

    const newAction = await Setting.create(body);

    return NextResponse.json(
      { success: true, data: newAction },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
