import { useState, useEffect } from "react";
import axios from "axios";

const useAuth = () => {
  const [role, setRole] = useState("loading"); // Initial state as 'loading'

  useEffect(() => {
    const controller = new AbortController();

    const checkAuth = async () => {
      try {
        const response = await axios.get("/api/check-auth", {
          signal: controller.signal, // Attach abort signal
        });
        setRole(response.data.role);
      } catch (error) {
        if (axios.isCancel(error)) return; // Avoid setting state if request is canceled
        console.error("Auth check failed:", error);
        setRole(null);
      }
    };

    checkAuth();

    return () => controller.abort(); // Cleanup function to cancel request
  }, []);

  return role;
};

export default useAuth;
