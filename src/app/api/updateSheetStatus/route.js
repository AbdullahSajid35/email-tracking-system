import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { rowIndex, status } = await req.json();
    const credentials = JSON.parse(
      Buffer.from(
        process.env.GOOGLE_SERVICE_ACCOUNT_BASE64,
        "base64"
      ).toString()
    );
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.SHEET_ID,
      range: `Sheet1!G${rowIndex + 2}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[status]],
      },
    });

    return NextResponse.json({ message: "Status updated successfully" });
  } catch (error) {
    console.error("Error updating sheet status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
