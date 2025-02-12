"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import emailjs from "emailjs-com";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ExcelEmailSender = () => {
  const [excelData, setExcelData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setExcelData(data);
      setIsModalOpen(true);
    };
    reader.readAsBinaryString(file);
  };

  const sendEmails = async () => {
    setIsSending(true);
    const totalEmails = excelData.length;
    let sentEmails = 0;

    for (const row of excelData) {
      const { Contact, PhoneNumber, EmailAddress, Make, Model, Reg } = row;

      const emailParams = {
        to_email: EmailAddress,
        from_email: "abdullah35.sajid@gmail.com",
        subject: "15082024",
        message: `Hi ${Contact},

        Outstanding Enquiry for ${Make} ${Model} ${Reg} Vehicle

        Phone Number ${PhoneNumber} as your phone number
        `,
      };

      try {
        await emailjs.send(
          "service_brcmulg",
          "template_ll3pp1b",
          emailParams,
          "ZHztMF_0JDYpmnSrs"
        );
        sentEmails++;
        setProgress((sentEmails / totalEmails) * 100);
        setRemainingTime((totalEmails - sentEmails) * 5);
      } catch (error) {
        console.error("Error sending email:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 seconds delay
    }

    setIsSending(false);
    setIsModalOpen(false);
  };

  return (
    <div className="p-4">
      <Input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excel Data Loaded</DialogTitle>
            <DialogDescription>
              Total records found: {excelData.length}
            </DialogDescription>
          </DialogHeader>
          {!isSending ? (
            <Button onClick={sendEmails}>Start Sending Emails</Button>
          ) : (
            <div className="space-y-4">
              <Progress value={progress} />
              <p>Sending emails... {Math.round(progress)}% complete</p>
              <p>
                Estimated time remaining: {Math.round(remainingTime / 60)}{" "}
                minutes
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExcelEmailSender;
