import { Resend } from 'resend'

export async function sendOtpEmail(to: string, otp: string, orgName: string) {
  if (!process.env.RESEND_API_KEY) {
    // מצב פיתוח — מדפיס את הקוד ללוג במקום לשלוח
    console.log(`\n📧 OTP for ${to}: ${otp}\n`)
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SH - Project Manager <onboarding@resend.dev>',
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
