import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const body = await req.json(); // Parse request body
    const { to_email, from_email, subject, message } = body;

    // Create a transporter object using SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASSWORD,
      },
    });

    const mailOptions = {
      from: from_email,
      to: to_email,
      subject: subject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    return new Response(JSON.stringify({ status: "Success" }), { status: 200 });
  } catch (error) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ status: "Fail", error: error.message }),
      { status: 500 }
    );
  }
}
