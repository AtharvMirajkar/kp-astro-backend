import nodemailer from "nodemailer";

// ── Transporter (configure via .env) ────────────────────────────────────────
// Supports: Gmail, SMTP, SendGrid, Mailgun etc.
const createTransporter = () => {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_SECURE,
    EMAIL_USER,
    EMAIL_PASS,
  } = process.env;

  // Gmail shortcut
  if (EMAIL_HOST === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
  }

  // Generic SMTP
  return nodemailer.createTransport({
    host:   EMAIL_HOST   || "smtp.gmail.com",
    port:   Number(EMAIL_PORT) || 587,
    secure: EMAIL_SECURE === "true",
    auth:   { user: EMAIL_USER, pass: EMAIL_PASS },
  });
};

const FROM_NAME    = process.env.EMAIL_FROM_NAME  || "Kundali App Admin";
const FROM_ADDRESS = process.env.EMAIL_USER        || "noreply@kundaliapp.com";

// ── Generic send helper ──────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from:    `"${FROM_NAME}" <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ""),
  });
  console.log(`[Email] Sent to ${to} — MessageId: ${info.messageId}`);
  return info;
};

// ── Password Reset Email ─────────────────────────────────────────────────────
export const sendPasswordResetEmail = async ({ to, name, resetToken, resetUrl }) => {
  const subject = "Password Reset Request — Kundali App Admin";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #FF6B35; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Password Reset</h1>
      </div>
      <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">Hello <strong>${name}</strong>,</p>
        <p style="color: #555;">
          We received a request to reset your password for the <strong>Kundali App Admin Panel</strong>.
          Click the button below to reset it.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}"
             style="background: #FF6B35; color: white; padding: 14px 32px;
                    text-decoration: none; border-radius: 6px; font-size: 16px;
                    font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">
          Or copy this link into your browser:<br/>
          <a href="${resetUrl}" style="color: #FF6B35; word-break: break-all;">${resetUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">
          ⏱ This link expires in <strong>15 minutes</strong>.<br/>
          If you did not request a password reset, ignore this email — your account is safe.
        </p>
        <p style="color: #aaa; font-size: 12px;">
          Token (if manual reset needed): <code>${resetToken}</code>
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

// ── Welcome / account-created email ─────────────────────────────────────────
export const sendWelcomeEmail = async ({ to, name, role }) => {
  const subject = "Welcome to Kundali App Admin Panel";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #FF6B35; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🌟 Welcome Aboard!</h1>
      </div>
      <div style="background: #f9f9f9; padding: 32px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333;">Hello <strong>${name}</strong>,</p>
        <p style="color: #555;">
          Your admin account has been created for the <strong>Kundali App Admin Panel</strong>.
        </p>
        <table style="background: #fff; border: 1px solid #eee; border-radius: 6px;
                      padding: 16px; width: 100%; margin: 16px 0;">
          <tr>
            <td style="color: #888; padding: 6px 12px;">Email</td>
            <td style="color: #333; font-weight: bold; padding: 6px 12px;">${to}</td>
          </tr>
          <tr>
            <td style="color: #888; padding: 6px 12px;">Role</td>
            <td style="color: #333; font-weight: bold; padding: 6px 12px; text-transform: capitalize;">${role}</td>
          </tr>
        </table>
        <p style="color: #888; font-size: 12px;">
          Please change your password after your first login.
        </p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

export default sendEmail;
