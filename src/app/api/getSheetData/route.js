import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Decode the base64 string into JSON
    const credentials = JSON.parse(
      Buffer.from(
        process.env.GOOGLE_SERVICE_ACCOUNT_BASE64,
        "base64"
      ).toString()
    );

    const auth = new google.auth.GoogleAuth({
      credentials, // Use parsed JSON credentials
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "Sheet1!A2:G",
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
