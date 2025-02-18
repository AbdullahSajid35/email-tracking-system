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
import { Send, Search, Loader2 } from "lucide-react";

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
  const sendingRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  const handleStart = () => {
    setIsModalOpen(true);
  };

  const sendEmails = async () => {
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
    const initialSeconds = (remainingEmails - 1) * emailDelay;
    startCountdown(initialSeconds);

    for (let i = startIndex; i < data.length; i++) {
      if (!sendingRef.current) break;
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
  
  Phone Number ${PhoneNumber} as your phone number`,
        };

        const response = await fetch("/api/sendEmail", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailParams),
        });

        console.log(response);

        if (!response.ok) {
          console.log("Error Throwing");
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

        if (i < data.length - 1 && sendingRef.current) {
          await new Promise((resolve) =>
            setTimeout(resolve, emailDelay * 1000)
          );
        }
      } catch (error) {
        console.error("Error sending email:", error);
        // Update status in data array
        data[i][6] = "Fail";
        // Update sheet status
        await updateSheetStatus(i, "Fail");
        setTimeout(resolve, emailDelay * 1000);
        continue;
      }
    }

    setIsSending(false);
    sendingRef.current = false;
    setIsModalOpen(false);
    if (timerRef.current) clearInterval(timerRef.current);
    await fetchData(); // Refresh data after completion
  };

  const updateSheetStatus = async (rowIndex, status) => {
    console.log(rowIndex, status);
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

  const handleStop = () => {
    sendingRef.current = false;
    setIsSending(false);
    if (timerRef.current) clearInterval(timerRef.current);
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
            </div>
            <Button
              onClick={handleStart}
              size="lg"
              className="bg-primary hover:bg-primary/90"
            >
              <Send className="mr-2 h-5 w-5" /> Start Sending Emails
            </Button>
          </div>
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

          {!isSending ? (
            <>
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
                    onChange={(e) => setEmailDelay(Number(e.target.value))}
                    className="col-span-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={sendEmails} className="w-full">
                  Start Sending
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-6 py-4">
              <Progress value={progress} className="w-full" />
              <p className="text-center text-lg">
                Sending emails...{" "}
                <span className="font-semibold">{Math.round(progress)}%</span>{" "}
                complete
              </p>
              <p className="text-center text-lg">
                Time remaining:{" "}
                <span className="font-semibold">
                  {formatTime(remainingSeconds)}
                </span>
              </p>
              <p className="text-center text-lg">
                Pending records:{" "}
                <span className="font-semibold">{pendingRecords}</span>
              </p>
              <Button
                onClick={handleStop}
                variant="destructive"
                className="w-full"
              >
                Stop Sending
              </Button>
            </div>
          )}
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
