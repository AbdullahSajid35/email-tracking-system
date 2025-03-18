import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

export async function middleware(request) {
  const token = request.cookies.get("token")?.value;

  const protectedPaths = ["/send-email", "/create-user"];
  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.JWT_SECRET)
      );

      console.log("CHECK", request.nextUrl.pathname.startsWith("/create-user"));

      // Check for specific roles
      if (
        request.nextUrl.pathname.startsWith("/create-user") &&
        payload.role === "USER"
      ) {
        console.log("User role:", payload.role, "OK");
        return NextResponse.redirect(new URL("/unauthorized", request.url));
      }

      // Add the user info to the request headers
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("user", JSON.stringify(payload));

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/send-email", "/create-user", "/unauthorized", "/login"],
};
