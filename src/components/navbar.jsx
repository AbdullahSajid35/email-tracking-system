"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Mail, MailX, Plus, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import useAuth from "@/hooks/useAuth";

export default function Navbar() {
  const role = useAuth();

  console.log(role, "ROLE");

  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const response = await fetch("/api/logout", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        localStorage.removeItem("userRole");
        localStorage.removeItem("userName");
        router.push("/login");
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="flex h-16 items-center justify-between bg-gradient-to-r from-primary/90 via-primary to-primary/80 shadow-md">
      {/* Left side with logo and text */}
      <div className="flex items-center gap-2 px-6">
        <Mail className="h-6 w-6 text-primary-foreground" />
        <h1 className="text-xl font-bold tracking-tight text-primary-foreground">
          Email Tracking System
        </h1>
      </div>

      {/* Right side with actions */}
      <div className="flex items-center gap-4 px-6">
        {role && (
          <Button
            variant="secondary"
            onClick={() => router.push("/send-email")}
            className="gap-2 font-medium text-sm"
          >
            <Mail className="h-4 w-4" />
            Email List
          </Button>
        )}
        {role && role === "ADMIN" && (
          <Button
            variant="secondary"
            size="sm"
            className="gap-1 hidden md:flex font-medium text-sm"
            onClick={() => router.push("/create-user")}
          >
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        )}

        {/* Desktop Logout */}
        <div className="hidden md:block">
          {role && (
            <Button
              variant="secondary"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="gap-2 font-medium text-white bg-red-600 hover:bg-red-600/90"
            >
              <LogOut className="h-4 w-4 text-white" />
              {isLoggingOut ? "Logging out..." : "Logout"}
            </Button>
          )}
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="icon">
                <User className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="grid gap-4 py-4">
                {role === "ADMIN" && (
                  <Button variant="outline" className="justify-start gap-2">
                    <Plus className="h-4 w-4" />
                    Create User
                  </Button>
                )}

                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="justify-start gap-2 mt-4"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
