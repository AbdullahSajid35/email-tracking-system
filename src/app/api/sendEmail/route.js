import nodemailer from "nodemailer";

export async function POST(req) {
  try {
    const body = await req.json(); // Parse request body
    const { to_email, subject, message } = body;

    const transporter = nodemailer.createTransport({
      host: "smtp.emailpnl.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.HILTON_EMAIL,
        pass: process.env.HILTON_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.HILTON_EMAIL,
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
