import nodemailer from 'nodemailer'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendOtpEmail(to: string, otp: string, orgName: string) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your-gmail@gmail.com') {
    // מצב פיתוח — מדפיס את הקוד ללוג במקום לשלוח
    console.log(`\n📧 OTP for ${to}: ${otp}\n`)
    return
  }

  const transporter = createTransport()
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `SH - Project Manager <${process.env.SMTP_USER}>`,
    to,
    subject: `קוד כניסה ל-SH - Project Manager — ${otp}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="background: #1B4F72; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">SH - Project Manager</h1>
          <p style="color: #a8c8e8; margin: 4px 0 0;">${orgName}</p>
        </div>

        <h2 style="color: #2C3E50; text-align: center;">קוד הכניסה שלך</h2>
        <p style="color: #555; text-align: center;">הזן קוד זה במסך הכניסה:</p>

        <div style="background: #F8F9FA; border: 2px dashed #1B4F72; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #1B4F72;">${otp}</span>
        </div>

        <p style="color: #888; font-size: 13px; text-align: center;">הקוד בתוקף ל-10 דקות בלבד.</p>
        <p style="color: #888; font-size: 12px; text-align: center;">אם לא ביקשת קוד זה, התעלם מהמייל.</p>
      </div>
    `,
  })
}
