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
  const backendBase = (process.env.BACKEND_PUBLIC_URL || "").replace(/\/$/, "");
  if (!backendBase) {
    throw new Error("BACKEND_PUBLIC_URL is not configured");
  }
  const verifyUrl = `${backendBase}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

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

export async function sendPasswordResetEmail(email, token) {
  const frontendBase = (process.env.FRONTEND_PUBLIC_URL || "").replace(/\/$/, "");
  if (!frontendBase) {
    throw new Error("FRONTEND_PUBLIC_URL is not configured");
  }
  const resetUrl = `${frontendBase}/reset-password.html?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: "[AI 면접 서비스] 비밀번호 재설정 안내",
    html: `
      <h2>비밀번호 재설정</h2>
      <p>30분 이내에 링크를 클릭해 비밀번호를 재설정해주세요.</p>
      <a href="${resetUrl}"
         style="display:inline-block;padding:10px 16px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">
        비밀번호 재설정하기
      </a>
      <p>버튼이 안 눌리면 아래 주소를 복사해서 접속해주세요.</p>
      <p>${resetUrl}</p>
      <p style="color:#868e96;font-size:12px;">본인이 요청하지 않았다면 이 메일을 무시해주세요.</p>
    `,
  });
}