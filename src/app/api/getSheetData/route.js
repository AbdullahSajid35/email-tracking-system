import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: "./main-file.json",
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: "1hKl-rbnjgT_o2-ECpGeBT_D4owR2Z8xkN1NuiZqRheg",
      range: "Sheet1!A2:F", // Adjusted to exclude the status column
    });

    const rows = response.data.values;

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
