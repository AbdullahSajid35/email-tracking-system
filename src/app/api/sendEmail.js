// pages/api/sendEmail.js

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { to_email, from_email, subject, message } = req.body;

    // Create a transporter object using SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SENDER_EMAIL, // Your email address
        pass: process.env.SENDER_PASSWORD, // Your email password or app password
      },
    });

    const mailOptions = {
      from: from_email,
      to: to_email,
      subject: subject,
      text: message,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.status(200).json({ status: "Success" });
    } catch (error) {
      console.error("Error sending email:", error);
      console.log(error);
      res.status(500).json({ status: "Fail", error: error.message });
    }
  } else {
    // Handle any other HTTP method
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
