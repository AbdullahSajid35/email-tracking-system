import ExcelEmailSender from "@/components/sections/ExcelEmailSender";
import GoogleSheetTable from "@/components/sections/GoogleSheetTable";
import React from "react";

function page() {
  return (
    <div>
      <ExcelEmailSender />
      <GoogleSheetTable />
    </div>
  );
}

export default page;
