import { cookies } from "next/headers";

export async function getUserRole() {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    // Use the existing check auth route
    const response = await fetch("/api/check-auth", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to verify token");
    }

    const data = await response.json();
    return data.role;
  } catch (error) {
    console.error("Error verifying token:", error);
    return null;
  }
}
