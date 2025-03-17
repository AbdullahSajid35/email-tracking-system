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
  const takingOverIntervalRef = useRef(null);

  const sendingRef = useRef(false);
  const timerRef = useRef(null);
  const statusCheckIntervalRef = useRef(null);

  // Generate a unique session ID for this browser session
  useEffect(() => {
    if (!sessionId) {
      setSessionId(
        `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      );
    }
  }, [sessionId]);

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
        setSystemStatus(settings);

        // If we're the active sender and someone has acknowledged, stop sending automatically
        if (
          settings.isRunning &&
          settings.acknowledged &&
          settings.currentUser === sessionId &&
          sendingRef.current
        ) {
          handleStop();
          // No alert/confirmation needed - just stop
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
      // Show error in UI
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/getSheetData");
      const result = await response.json();
      setData(result);
      const pending = result.filter((row) => !row[6] || row[6] === "").length;
      setPendingRecords(pending);
      setTotalRecords(result.length);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setIsLoading(false);
  };

  const filteredData = data.filter((row) =>
    Object.values(row).some((value) =>
      value.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleStart = async () => {
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

  // Modify the sendEmails function to close the modal after starting
  const sendEmails = async () => {
    // Set system status to running
    if (emailDelay == "") {
      alert("Plase enter delay time");
      return;
    }

    const statusUpdated = await updateSystemStatus(true);
    if (!statusUpdated) {
      alert("Failed to update system status. Please try again.");
      return;
    }

    // Close the modal immediately after starting
    setIsModalOpen(false);

    setIsSending(true);
    sendingRef.current = true;

    const processedEmails = data.filter(
      (row) => row[6] && row[6] !== ""
    ).length;
    const totalEmails = data.length;
    const initialProgress = (processedEmails / totalEmails) * 100;
    setProgress(initialProgress);

    const startIndex = lastProcessedIndex === -1 ? 0 : lastProcessedIndex + 1;
    const remainingEmails = data.filter(
      (row, index) => index >= startIndex && (!row[6] || row[6] === "")
    ).length;
    let remainingTime = remainingEmails * emailDelay;
    startCountdown(remainingTime);

    // Set up a separate interval to check for acknowledgment every minute
    const acknowledgeCheckInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/settings");
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data.length > 0) {
            const settings = result.data[0];
            if (settings.acknowledged && settings.currentUser === sessionId) {
              // No alert/confirmation needed - just stop after current email
              sendingRef.current = false;
            }
          }
        }
      } catch (error) {
        console.error("Error checking for acknowledgment:", error);
      }
    }, 60000); // Check every minute

    for (let i = startIndex; i < data.length; i++) {
      // Check if we should stop due to acknowledgment
      try {
        await checkSystemStatus();
      } catch (error) {
        console.error("Error checking status during sending:", error);
        // Continue anyway, we'll use the last known status
      }

      if (!sendingRef.current || (systemStatus && systemStatus.acknowledged)) {
        break;
      }

      const row = data[i];

      // Skip if already processed
      if (row[6] && row[6] !== "") {
        continue;
      }

      const [Contact, PhoneNumber, EmailAddress, Make, Model, Reg] = row;

      try {
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

        // Update status in data array
        data[i][6] = "Success";
        // Update sheet status
        await updateSheetStatus(i, "Success");

        setLastProcessedIndex(i);
        const processedCount = data.filter(
          (row) => row[6] && row[6] !== ""
        ).length;
        const currentProgress = (processedCount / totalEmails) * 100;
        setProgress(currentProgress);
        setPendingRecords(totalEmails - processedCount);
      } catch (error) {
        console.error("Error sending email:", error);
        // Update status in data array
        data[i][6] = "Fail";
        // Update sheet status
        try {
          await updateSheetStatus(i, "Fail");
        } catch (sheetError) {
          console.error("Error updating sheet status:", sheetError);
        }
      }

      // Recalculate remaining time after each email (success or fail)
      remainingTime -= emailDelay;
      setRemainingSeconds(remainingTime);

      // Wait for the delay before processing the next email
      if (i < data.length - 1 && sendingRef.current) {
        await new Promise((resolve) => setTimeout(resolve, emailDelay * 1000));
      }
    }

    // Clear the acknowledgment check interval
    clearInterval(acknowledgeCheckInterval);

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
    await fetchData(); // Refresh data after completion
  };

  const updateSheetStatus = async (rowIndex, status) => {
    try {
      await fetch("/api/updateSheetStatus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rowIndex, status }),
      });
    } catch (error) {
      console.error("Error updating sheet status:", error);
    }
  };

  const handleStop = async () => {
    sendingRef.current = false;
    setIsSending(false);
    if (timerRef.current) clearInterval(timerRef.current);

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

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl text-center font-bold">
            Hilton Car SuperMarket
          </CardTitle>
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
                    <span className="font-semibold">System is busy</span> -
                    Started{" "}
                    {new Date(systemStatus.startedAt).toLocaleTimeString()}
                  </p>
                )}
            </div>
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

      {/* Remove the non-dismissible behavior from the Dialog component */}
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
            <DialogTitle>System Busy</DialogTitle>
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

      {/* Make the takeover dialog non-cancelable by setting onOpenChange to a function that does nothing */}
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
          {/* Removed the Cancel Request button */}
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
