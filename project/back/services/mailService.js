import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 465),
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function sendVerificationEmail(email, token) {
  const verifyUrl = `${process.env.BACKEND_PUBLIC_URL}/api/auth/verify-email?token=${token}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "[AI 면접 서비스] 이메일 인증을 완료해주세요",
    html: `
      <h2>이메일 인증</h2>
      <p>아래 버튼을 눌러 이메일 인증을 완료해주세요.</p>
      <a href="${verifyUrl}" 
         style="display:inline-block;padding:10px 16px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">
        이메일 인증하기
      </a>
      <p>버튼이 안 눌리면 아래 주소를 복사해서 접속해주세요.</p>
      <p>${verifyUrl}</p>
    `,
  });
}