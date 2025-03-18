import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function GET(request) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    return NextResponse.json({ role: payload.role }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }
}
