"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Search, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ExcelEmailSender = () => {
  // Debug function to log timing information
  const logTimingInfo = (message, startTime) => {
    const now = Date.now();
    const elapsed = now - startTime;
    console.log(
      `${message} - Time: ${new Date(now).toLocaleTimeString()}, Elapsed: ${
        elapsed / 1000
      }s`
    );
    return now;
  };

  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingRecords, setPendingRecords] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const [emailDelay, setEmailDelay] = useState(120);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(-1);
  const [systemStatus, setSystemStatus] = useState(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [systemError, setSystemError] = useState(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [canTakeOver, setCanTakeOver] = useState(false);
  const [runningUser, setRunningUser] = useState(null);

  const sendingRef = useRef(false);
  const timerRef = useRef(null);
  const statusCheckIntervalRef = useRef(null);
  const acknowledgeCheckIntervalRef = useRef(null);
  const dataRefreshIntervalRef = useRef(null);
  const takingOverIntervalRef = useRef(null);
  const currentDataRef = useRef([]); // Reference to always have the latest data

  // Generate a unique session ID for this browser session
  useEffect(() => {
    if (!sessionId) {
      setSessionId(
        `${localStorage.getItem("userName") || "user"}_${Date.now()}`
      );
    }
  }, [sessionId]);

  // Handle page unload to update system status
  useEffect(() => {
    // Ensure useEffect runs only when sessionId matches runningUser
    if (sessionId !== runningUser) return;

    function handleBeforeUnload() {
      // Create the data to send
      const data = JSON.stringify({
        acknowledged: false,
        isRunning: false,
        currentUser: "",
      });

      // Use sendBeacon for reliability during page unload
      navigator.sendBeacon("/api/updateSettings", data);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionId, runningUser]);

  // Initial setup and cleanup
  useEffect(() => {
    fetchData();
    checkSystemStatus();

    // Set up interval to check system status every 5 seconds
    statusCheckIntervalRef.current = setInterval(checkSystemStatus, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (statusCheckIntervalRef.current)
        clearInterval(statusCheckIntervalRef.current);
      if (takingOverIntervalRef.current)
        clearInterval(takingOverIntervalRef.current);
      if (acknowledgeCheckIntervalRef.current)
        clearInterval(acknowledgeCheckIntervalRef.current);
      if (dataRefreshIntervalRef.current)
        clearInterval(dataRefreshIntervalRef.current);
    };
  }, []);

  const checkSystemStatus = async () => {
    try {
      setIsLoading((prevLoading) =>
        prevLoading === false ? prevLoading : true
      );

      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error(
          `Failed to fetch settings: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      if (result.success && result.data.length > 0) {
        const settings = result.data[0];
        setRunningUser(settings.currentUser);
        setSystemStatus(settings);

        // If we're the active sender and someone has acknowledged, stop sending automatically
        if (
          settings.isRunning &&
          settings.acknowledged &&
          settings.currentUser === sessionId &&
          sendingRef.current
        ) {
          handleStop();
        }
      } else {
        // If no settings exist, create initial settings
        const createResponse = await fetch("/api/settings", { method: "POST" });
        if (!createResponse.ok) {
          throw new Error(
            `Failed to create settings: ${createResponse.status} ${createResponse.statusText}`
          );
        }
        await checkSystemStatus();
      }
    } catch (error) {
      console.error("Error checking system status:", error);
      setSystemError("Failed to check system status. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (totalSeconds) => {
    if (totalSeconds <= 0) return "0:00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const startCountdown = (initialSeconds) => {
    setRemainingSeconds(initialSeconds);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 0) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await fetch("/api/getSheetData");
      if (!response.ok) {
        throw new Error(
          `Failed to fetch data: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // Update the ref first to ensure we always have the latest data
      currentDataRef.current = result;

      // Then update the state
      setData(result);

      // Calculate pending records correctly
      const pending = result.filter((row) => !row[6] || row[6] === "").length;
      setPendingRecords(pending);
      setTotalRecords(result.length);

      // Recalculate progress if we're sending
      if (sendingRef.current) {
        const processedCount = result.filter(
          (row) => row[6] && row[6] !== ""
        ).length;
        const currentProgress = (processedCount / result.length) * 100;
        setProgress(currentProgress);
      }

      return result; // Return the data for immediate use
    } catch (error) {
      console.error("Error fetching data:", error);
      if (!silent) {
        setSystemError("Failed to fetch data. Please try again.");
      }
      return null;
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const filteredData = data.filter((row) =>
    Object.values(row).some((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleStart = async () => {
    // First, fetch the latest data to ensure we're working with up-to-date information
    try {
      await fetchData();
    } catch (error) {
      console.error("Error refreshing data before starting:", error);
      alert("Failed to refresh data. Please try again.");
      return;
    }

    // Check if someone else is already sending emails
    await checkSystemStatus();

    if (
      systemStatus &&
      systemStatus.isRunning &&
      systemStatus.currentUser !== sessionId
    ) {
      setIsAcknowledging(true);
    } else {
      setIsModalOpen(true);
    }
  };

  const acknowledgeAndWait = async () => {
    try {
      setIsUpdatingStatus(true);
      setTakingOver(true);

      const response = await fetch("/api/updateSettings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ acknowledged: true }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to acknowledge: ${response.status} ${response.statusText}`
        );
      }

      setIsAcknowledging(false);

      // Start checking every minute if we can take over
      if (takingOverIntervalRef.current)
        clearInterval(takingOverIntervalRef.current);

      takingOverIntervalRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch("/api/settings");
          if (!statusResponse.ok) {
            throw new Error(
              `Failed to fetch settings: ${statusResponse.status} ${statusResponse.statusText}`
            );
          }

          const result = await statusResponse.json();

          if (result.success && result.data.length > 0) {
            const settings = result.data[0];
            setRunningUser(settings.currentUser);

            // If the system is no longer running, we can take over
            if (!settings.isRunning) {
              clearInterval(takingOverIntervalRef.current);
              setTakingOver(false);
              setCanTakeOver(true);
            }
          }
        } catch (error) {
          console.error("Error checking if can take over:", error);
        }
      }, 60000); // Check every minute

      // Also do an immediate check after 5 seconds
      setTimeout(async () => {
        try {
          const statusResponse = await fetch("/api/settings");
          if (statusResponse.ok) {
            const result = await statusResponse.json();
            if (result.success && result.data.length > 0) {
              const settings = result.data[0];
              setRunningUser(settings.currentUser);
              if (!settings.isRunning) {
                clearInterval(takingOverIntervalRef.current);
                setTakingOver(false);
                setCanTakeOver(true);
              }
            }
          }
        } catch (error) {
          console.error("Error in initial takeover check:", error);
        }
      }, 5000);
    } catch (error) {
      console.error("Error acknowledging:", error);
      setSystemError("Failed to request takeover. Please try again.");
      setTakingOver(false);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const updateSystemStatus = async (isRunning) => {
    try {
      setIsUpdatingStatus(true);

      const response = await fetch("/api/updateSettings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isRunning,
          acknowledged: false,
          currentUser: isRunning ? sessionId : "",
          startedAt: isRunning ? new Date() : systemStatus?.startedAt,
          delayTime: emailDelay,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to update settings: ${response.status} ${response.statusText}`
        );
      }

      await checkSystemStatus();
      return true;
    } catch (error) {
      console.error("Error updating system status:", error);
      setSystemError("Failed to update system status. Please try again.");
      return false;
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const updateSheetStatus = async (rowIndex, status) => {
    try {
      const response = await fetch("/api/updateSheetStatus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rowIndex, status }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to update sheet status: ${response.status} ${response.statusText}`
        );
      }

      return true;
    } catch (error) {
      console.error("Error updating sheet status:", error);
      return false;
    }
  };

  const handleStop = async () => {
    sendingRef.current = false;
    setIsSending(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (acknowledgeCheckIntervalRef.current)
      clearInterval(acknowledgeCheckIntervalRef.current);
    if (dataRefreshIntervalRef.current)
      clearInterval(dataRefreshIntervalRef.current);

    // Update system status to not running
    await updateSystemStatus(false);
  };

  // Determine if current user is the one sending emails
  const isCurrentUserSending =
    systemStatus?.isRunning && systemStatus?.currentUser === sessionId;

  // Determine if someone else is sending emails
  const isSomeoneElseSending =
    systemStatus?.isRunning && systemStatus?.currentUser !== sessionId;

  // Add this function to handle starting after takeover
  const handleStartAfterTakeover = () => {
    setCanTakeOver(false);
    setIsModalOpen(true);
  };

  // Improved sendEmails function to fix duplicate sending and progress issues
  const sendEmails = async () => {
    // Validate delay time
    if (emailDelay === "") {
      alert("Please enter delay time");
      return;
    }

    // Set system status to running first
    const statusUpdated = await updateSystemStatus(true);
    if (!statusUpdated) {
      alert("Failed to update system status. Please try again.");
      return;
    }

    // Close the modal immediately after starting
    setIsModalOpen(false);

    // CRITICAL: Fetch the latest data AFTER updating system status
    const freshData = await fetchData();
    if (!freshData) {
      alert("Failed to refresh data. Please try again.");
      await updateSystemStatus(false); // Revert system status if we can't fetch data
      return;
    }

    // Calculate initial progress and pending records
    const processedEmails = freshData.filter(
      (row) => row[6] && row[6] !== ""
    ).length;
    const totalEmails = freshData.length;
    const initialProgress = (processedEmails / totalEmails) * 100;
    setProgress(initialProgress);
    setPendingRecords(totalEmails - processedEmails);

    // Find the first unprocessed record
    let startIndex = -1;
    for (let i = 0; i < freshData.length; i++) {
      if (!freshData[i][6] || freshData[i][6] === "") {
        startIndex = i;
        break;
      }
    }

    // If all records are processed, notify and exit
    if (startIndex === -1) {
      alert("All records have been processed. Refreshing data.");
      await updateSystemStatus(false);
      return;
    }

    setLastProcessedIndex(startIndex - 1);

    // Calculate remaining emails and time more accurately
    const pendingEmails = freshData.filter(
      (row, index) => index >= startIndex && (!row[6] || row[6] === "")
    ).length;

    const remainingTime = pendingEmails * emailDelay;
    startCountdown(remainingTime);

    setIsSending(true);
    sendingRef.current = true;

    // Set up a regular interval to refresh data during sending
    dataRefreshIntervalRef.current = setInterval(async () => {
      if (sendingRef.current) {
        await fetchData(true);
      }
    }, 3000); // Refresh every 3 seconds

    // Set up interval to check for acknowledgment
    if (acknowledgeCheckIntervalRef.current)
      clearInterval(acknowledgeCheckIntervalRef.current);

    acknowledgeCheckIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.length > 0) {
            const settings = result.data[0];
            setRunningUser(settings.currentUser);
            if (settings.acknowledged && settings.currentUser === sessionId) {
              // Stop after current email
              sendingRef.current = false;
            }
          }
        }
      } catch (error) {
        console.error("Error checking for acknowledgment:", error);
      }
    }, 60000); // Check every minute

    // Process emails one by one with precise cumulative timing
    try {
      // Get fresh data right before starting the loop
      const latestData = await fetchData(true);
      if (!latestData) {
        throw new Error(
          "Failed to fetch latest data before starting email process"
        );
      }

      // Track the start time for cumulative timing
      const processStartTime = Date.now();

      // Log the start time for debugging
      console.log(
        `Process started at: ${new Date(processStartTime).toLocaleTimeString()}`
      );

      for (let i = startIndex; i < latestData.length; i++) {
        // Check if we should stop
        if (!sendingRef.current) {
          console.log("Stopping email sending process");
          break;
        }

        try {
          await checkSystemStatus();
        } catch (error) {
          console.error("Error checking status during sending:", error);
        }

        if (systemStatus && systemStatus.acknowledged) {
          console.log("Stopping due to acknowledgment");
          break;
        }

        // Calculate the exact time this email should be sent (based on its position)
        const emailIndex = i - startIndex;
        const exactSendTime = processStartTime + emailIndex * emailDelay * 1000;

        // Log the scheduled time for this email
        console.log(
          `Email ${emailIndex + 1} scheduled for: ${new Date(
            exactSendTime
          ).toLocaleTimeString()}`
        );

        // Get the latest data for this row
        const freshDataForRow = await fetchData(true);
        if (!freshDataForRow) {
          console.error("Failed to fetch fresh data for row", i);
          continue; // Skip this row if we can't get fresh data
        }

        const row = freshDataForRow[i];

        // CRITICAL: Double-check if already processed using the latest data
        if (row[6] && row[6] !== "") {
          console.log(
            `Skipping row ${i} as it's already processed with status: ${row[6]}`
          );
          continue;
        }

        const [Contact, PhoneNumber, EmailAddress, Make, Model, Reg] = row;

        try {
          // First update the sheet status to "Processing" to prevent duplicates
          console.log(`Setting row ${i} to Processing status`);
          const updateResult = await updateSheetStatus(i, "Processing");
          if (!updateResult) {
            throw new Error("Failed to update sheet status to Processing");
          }

          // Refresh data to ensure UI is in sync with sheet
          await fetchData(true);

          console.log(`Sending email to ${EmailAddress} for ${Make} ${Model}`);
          const emailParams = {
            to_email: EmailAddress,
            from_email: "abdullah35.sajid@gmail.com",
            subject: "New Enquiries: 15082024",
            message: `Hi ${Contact},

Outstanding Enquiry for ${Make} ${Model} ${Reg} Vehicle

Phone Number ${PhoneNumber} as your phone number

Regards`,
          };

          const response = await fetch("/api/sendEmail", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(emailParams),
          });

          if (!response.ok) {
            throw new Error(response.statusText);
          }

          // Update sheet status to Success
          console.log(`Setting row ${i} to Success status`);
          await updateSheetStatus(i, "Success");

          // Refresh data to ensure UI is in sync with sheet
          const updatedData = await fetchData(true);

          setLastProcessedIndex(i);

          // Recalculate progress and pending records
          if (updatedData) {
            const processedCount = updatedData.filter(
              (row) => row[6] && row[6] !== ""
            ).length;
            const currentProgress = (processedCount / updatedData.length) * 100;
            setProgress(currentProgress);
            setPendingRecords(updatedData.length - processedCount);

            // Update remaining time based on actual pending records
            const remainingRows = updatedData.filter(
              (row, idx) => idx > i && (!row[6] || row[6] === "")
            ).length;
            setRemainingSeconds(remainingRows * emailDelay);
          }
        } catch (error) {
          console.error(`Error sending email for row ${i}:`, error);

          // Update sheet status to Fail
          try {
            console.log(`Setting row ${i} to Fail status`);
            await updateSheetStatus(i, "Fail");

            // Refresh data to ensure UI is in sync with sheet
            const updatedData = await fetchData(true);

            // Recalculate progress based on freshly fetched data
            if (updatedData) {
              const processedCount = updatedData.filter(
                (row) => row[6] && row[6] !== ""
              ).length;
              const currentProgress =
                (processedCount / updatedData.length) * 100;
              setProgress(currentProgress);
              setPendingRecords(updatedData.length - processedCount);
            }
          } catch (sheetError) {
            console.error("Error updating sheet status:", sheetError);
          }
        }

        // Now check if we need to wait before the next email to maintain the exact timing
        if (i < latestData.length - 1 && sendingRef.current) {
          const now = Date.now();
          const nextEmailIndex = emailIndex + 1;
          const nextEmailTime =
            processStartTime + nextEmailIndex * emailDelay * 1000;
          const waitTime = Math.max(0, nextEmailTime - now);

          console.log(
            `Email ${
              emailIndex + 1
            } completed at: ${new Date().toLocaleTimeString()}`
          );
          console.log(
            `Next email (${nextEmailIndex + 1}) scheduled for: ${new Date(
              nextEmailTime
            ).toLocaleTimeString()}`
          );
          console.log(
            `Waiting ${Math.round(
              waitTime / 1000
            )} seconds to maintain exact timing`
          );

          if (waitTime > 0) {
            await new Promise((resolve) => setTimeout(resolve, waitTime));
          } else {
            console.log(
              `Processing took longer than delay time, sending next email immediately`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error in email sending process:", error);
      setSystemError("An error occurred during the email sending process.");
    } finally {
      // Clean up regardless of how the loop exits
      if (acknowledgeCheckIntervalRef.current)
        clearInterval(acknowledgeCheckIntervalRef.current);
      if (dataRefreshIntervalRef.current)
        clearInterval(dataRefreshIntervalRef.current);

      // Update system status to not running
      try {
        await updateSystemStatus(false);
      } catch (error) {
        console.error("Error updating system status after completion:", error);
      }

      setIsSending(false);
      sendingRef.current = false;
      setIsModalOpen(false);
      if (timerRef.current) clearInterval(timerRef.current);

      // Final data refresh
      await fetchData();

      console.log("Email sending process completed");
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-center font-bold">
            Hilton Car SuperMarket
          </CardTitle>
        </CardHeader>
        <CardContent>
          {systemError && (
            <Alert className="mb-4" variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {systemError}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    setSystemError(null);
                    checkSystemStatus();
                  }}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {isSomeoneElseSending && !takingOver && (
            <Alert className="mb-4" variant="warning">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Email Sending in Progress</AlertTitle>
              <AlertDescription>
                Another user is currently sending emails. You can request to
                take over by clicking the button below.
              </AlertDescription>
            </Alert>
          )}

          {takingOver && (
            <Alert className="mb-4" variant="info">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Waiting for Current Process</AlertTitle>
              <AlertDescription>
                Your request to take over has been sent. The system will notify
                you when you can start.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between items-center mb-6">
            <div className="space-y-2">
              <p className="text-lg">
                Total Records:{" "}
                <span className="font-semibold">{totalRecords}</span>
              </p>
              <p className="text-lg">
                Pending Records:{" "}
                <span className="font-semibold">{pendingRecords}</span>
              </p>
              {systemStatus?.isRunning &&
                systemStatus?.currentUser !== sessionId && (
                  <p className="text-lg text-amber-600">
                    <span className="font-semibold">
                      Email Sending Process is Running by{" "}
                      {runningUser ? runningUser.split("_")[0] : "-"}
                    </span>{" "}
                    - Started{" "}
                    {new Date(systemStatus.startedAt).toLocaleTimeString()}
                  </p>
                )}
            </div>
            <div className="flex flex-col gap-2">
              {isCurrentUserSending ? (
                <Button
                  onClick={handleStop}
                  size="lg"
                  variant="destructive"
                  className="hover:bg-destructive/90"
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Stop Sending Emails
                </Button>
              ) : (
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="bg-primary hover:bg-primary/90"
                  disabled={isLoading || isUpdatingStatus || takingOver}
                >
                  {isLoading || isUpdatingStatus ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-5 w-5" />
                  )}
                  {isSomeoneElseSending
                    ? "Request to Send Emails"
                    : "Start Sending Emails"}
                </Button>
              )}
              <Button
                onClick={fetchData}
                size="sm"
                variant="outline"
                className="px-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Refresh Data
              </Button>
            </div>
          </div>

          {/* Always show progress information in the main UI when sending */}
          {isCurrentUserSending && (
            <div className="mt-4 space-y-4">
              <Progress value={progress} className="w-full" />
              <div className="flex justify-between">
                <p className="text-lg">
                  Progress:{" "}
                  <span className="font-semibold">{Math.round(progress)}%</span>
                </p>
                <p className="text-lg">
                  Time remaining:{" "}
                  <span className="font-semibold">
                    {formatTime(remainingSeconds)}
                  </span>
                </p>
              </div>
              <p className="text-lg">
                Pending records:{" "}
                <span className="font-semibold">{pendingRecords}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Email Sending Configuration</DialogTitle>
            <DialogDescription>
              Configure the email sending settings below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="emailDelay" className="text-right col-span-2">
                Delay between emails (seconds):
              </label>
              <Input
                id="emailDelay"
                type="number"
                min="1"
                value={emailDelay}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmailDelay(value === "" ? "" : Number(value));
                }}
                className="col-span-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={sendEmails}
              className="w-full"
              disabled={isUpdatingStatus}
            >
              {isUpdatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start Sending
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAcknowledging} onOpenChange={setIsAcknowledging}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Process is running by{" "}
              {runningUser ? runningUser.split("_")[0] : "-"}
            </DialogTitle>
            <DialogDescription>
              Another user is currently sending emails. Would you like to
              request to take over?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              If you request to take over, the current user's process will stop
              after the current email is sent, and you will be able to start
              sending.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAcknowledging(false)}>
              Cancel
            </Button>
            <Button onClick={acknowledgeAndWait} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Request to Take Over
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={takingOver}
        onOpenChange={() => {}}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogContent
          className="sm:max-w-[425px]"
          onPointerDownOutside={(e) => e.preventDefault()}
          hideCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle>Waiting for Current Process to Finish</DialogTitle>
            <DialogDescription>
              Your request to take over has been sent. Please wait for the
              current user to finish.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-center">
              The system will automatically notify you when you can start
              sending emails. This may take some time if the current user has a
              long delay between emails.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={canTakeOver} onOpenChange={setCanTakeOver}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>You Can Now Send Emails</DialogTitle>
            <DialogDescription>
              The previous user has stopped sending emails. You can now start
              your email process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>Click the button below to configure and start sending emails.</p>
          </div>
          <DialogFooter>
            <Button onClick={handleStartAfterTakeover}>
              Start Sending Emails
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-center font-bold">
            Filtered Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow"
            />
          </div>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Make</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Reg</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row[0]}</TableCell>
                      <TableCell>{row[1]}</TableCell>
                      <TableCell>{row[2]}</TableCell>
                      <TableCell>{row[3]}</TableCell>
                      <TableCell>{row[4]}</TableCell>
                      <TableCell>{row[5]}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row[6] === "Success"
                              ? "success"
                              : row[6] === "Fail"
                              ? "destructive"
                              : row[6] === "Processing"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {row[6] || "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExcelEmailSender;
