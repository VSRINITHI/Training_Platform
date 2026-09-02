"""
Production-grade, provider-agnostic Email Service for DataCaliper Training Platform.

Architecture:
- BaseEmailProvider: Abstract interface for email delivery providers.
- SMTPEmailProvider: Standard SMTP implementation with TLS/SSL support.
- ConsoleEmailProvider: Development/test provider that safely records transmissions.
- EmailService: High-level application service that formats branded templates and
  orchestrates delivery via the configured provider.

Security Guidelines:
- Application sender is configured ONCE in backend environment (EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME).
- Recipient email addresses are passed dynamically per request and never stored in configuration.
- Secure invitation action links are NEVER logged at INFO level.
- Credentials and secrets are NEVER exposed in error messages or sent to the client.
"""
import abc
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── Abstract Provider Interface ───────────────────────────────────────────────

class BaseEmailProvider(abc.ABC):
    """Abstract interface for email delivery providers (SMTP, SES, Resend, Postmark, etc.)."""

    @abc.abstractmethod
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Sends an email to the specified recipient.

        Returns:
            Tuple[bool, Optional[str]]: (success, error_message)
        """
        pass


# ─── SMTP Email Provider ───────────────────────────────────────────────────────

class SMTPEmailProvider(BaseEmailProvider):
    """Standard SMTP email provider with TLS/SSL support."""

    def __init__(self):
        self.host = settings.SMTP_HOST
        self.port = settings.SMTP_PORT
        self.username = settings.SMTP_USERNAME
        self.password = settings.SMTP_PASSWORD
        self.use_tls = settings.SMTP_USE_TLS
        self.from_address = settings.EMAIL_FROM_ADDRESS
        self.from_name = settings.EMAIL_FROM_NAME

    def is_configured(self) -> bool:
        """Returns True if minimum required SMTP settings are present."""
        return bool(self.host and self.from_address)

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: str,
    ) -> Tuple[bool, Optional[str]]:
        if not self.is_configured():
            msg = "SMTP provider is not configured. Set SMTP_HOST and credentials in backend environment."
            logger.warning("Email delivery skipped for %s: %s", to_email, msg)
            return False, msg

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_address}>"
        msg["To"] = to_email

        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            if self.use_tls:
                context = ssl.create_default_context()
                with smtplib.SMTP(self.host, self.port, timeout=15) as smtp:
                    smtp.ehlo()
                    smtp.starttls(context=context)
                    smtp.ehlo()
                    if self.username and self.password:
                        smtp.login(self.username, self.password)
                    smtp.sendmail(self.from_address, [to_email], msg.as_string())
            else:
                with smtplib.SMTP_SSL(self.host, self.port, timeout=15) as smtp:
                    if self.username and self.password:
                        smtp.login(self.username, self.password)
                    smtp.sendmail(self.from_address, [to_email], msg.as_string())

            logger.info("Email delivered successfully to %s", to_email)
            return True, None

        except smtplib.SMTPAuthenticationError:
            err = "SMTP authentication failed. Verify server credentials."
            logger.error("SMTP error sending to %s: %s", to_email, err)
            return False, err
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError) as e:
            err = f"SMTP connection error: {type(e).__name__}"
            logger.error("SMTP connection failed sending to %s: %s", to_email, e)
            return False, err
        except Exception as e:
            err = f"Email delivery error: {type(e).__name__}"
            logger.error("Unexpected error sending email to %s: %s", to_email, e)
            return False, err


# ─── Console Email Provider (Dev / Fallback) ───────────────────────────────────

class ConsoleEmailProvider(BaseEmailProvider):
    """Development provider that logs email transmission without external connections."""

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: str,
    ) -> Tuple[bool, Optional[str]]:
        from_header = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
        logger.info(
            "[ConsoleEmailProvider] Email queued: From='%s' To='%s' Subject='%s'",
            from_header,
            to_email,
            subject,
        )
        return True, None


# ─── Email Service & Template Engine ──────────────────────────────────────────

class EmailService:
    """High-level application email service with branded template generation."""

    def __init__(self):
        self._provider = self._resolve_provider()

    def _resolve_provider(self) -> BaseEmailProvider:
        provider_type = (settings.EMAIL_PROVIDER or "smtp").lower().strip()
        if provider_type == "console":
            return ConsoleEmailProvider()
        return SMTPEmailProvider()

    def send_invitation(
        self,
        recipient_email: str,
        role: str,
        action_link: str,
        invited_by_name: str,
    ) -> Tuple[bool, Optional[str]]:
        """
        Builds and sends a professionally branded invitation email.

        Returns:
            Tuple[bool, Optional[str]]: (delivered_successfully, error_message_if_any)
        """
        subject = "You've been invited to DataCaliper Training Platform"
        html_body = self._render_invitation_html(recipient_email, role, action_link, invited_by_name)
        plain_body = self._render_invitation_plain(recipient_email, role, action_link, invited_by_name)

        return self._provider.send_email(
            to_email=recipient_email,
            subject=subject,
            html_body=html_body,
            plain_body=plain_body,
        )

    def _render_invitation_html(
        self,
        recipient_email: str,
        role: str,
        action_link: str,
        invited_by_name: str,
    ) -> str:
        is_instructor = role.upper() == "INSTRUCTOR"
        role_title = "INSTRUCTOR" if is_instructor else "Standard Learner"
        role_display = "Instructor" if is_instructor else "Standard Learner"
        portal_name = "Instructor Portal" if is_instructor else "Learner Portal"

        if is_instructor:
            feature_items = """
              <li style="margin-bottom:8px;"><strong>Create courses</strong> — Author rich, multi-module learning curriculums.</li>
              <li style="margin-bottom:8px;"><strong>Build modules &amp; lessons</strong> — Structure video, text, and interactive materials.</li>
              <li style="margin-bottom:8px;"><strong>Create assessments</strong> — Configure comprehensive quizzes and exam gates.</li>
              <li style="margin-bottom:8px;"><strong>Review AI-generated quiz drafts</strong> — Curate and approve AI-assisted question sets.</li>
              <li style="margin-bottom:0;"><strong>Publish courses</strong> — Launch approved courses to learners platform-wide.</li>
            """
        else:
            feature_items = """
              <li style="margin-bottom:8px;"><strong>Discover courses</strong> — Explore tailored courses across technical domains.</li>
              <li style="margin-bottom:8px;"><strong>Enroll in courses</strong> — Join structured curriculums with full progress tracking.</li>
              <li style="margin-bottom:8px;"><strong>Complete lessons</strong> — Study rich modular content at your own pace.</li>
              <li style="margin-bottom:8px;"><strong>Take assessments</strong> — Validate your skills with lesson and module quizzes.</li>
              <li style="margin-bottom:8px;"><strong>Track learning progress</strong> — Monitor milestones across your learning journey.</li>
              <li style="margin-bottom:0;"><strong>Earn certificates</strong> — Receive verified certificates upon course completion.</li>
            """

        accent_color = "#4F46E5"  # DataCaliper indigo

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to DataCaliper Training Platform</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F8FAFC;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600"
               style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #E2E8F0;">

          <!-- Header -->
          <tr>
            <td style="background:{accent_color};padding:36px 40px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:rgba(255,255,255,0.18);border-radius:12px;padding:10px 14px;margin-bottom:12px;">
                      <span style="font-size:26px;color:#FFFFFF;">🎓</span>
                    </div>
                    <h1 style="color:#FFFFFF;font-size:26px;font-weight:800;margin:0;letter-spacing:-0.5px;">DataCaliper</h1>
                    <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;letter-spacing:1px;font-weight:600;">TRAINING PLATFORM</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding:40px 40px 32px;background:#FFFFFF;">
              <p style="color:#1E293B;font-size:18px;font-weight:700;margin:0 0 16px;">
                Hello,
              </p>
              <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
                You have been invited to join the <strong>DataCaliper Training Platform</strong> by <strong>{invited_by_name}</strong>.
              </p>

              <!-- Role Banner -->
              <div style="background:#EEF2FF;border-left:4px solid {accent_color};border-radius:0 12px 12px 0;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:{accent_color};text-transform:uppercase;letter-spacing:0.5px;">
                  YOUR ASSIGNED ROLE
                </p>
                <p style="margin:0;font-size:20px;font-weight:800;color:#1E293B;">
                  {role_title}
                </p>
              </div>

              <!-- Role Capabilities -->
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1E293B;">
                  With your {role_display} access, you can:
                </p>
                <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.6;">
                  {feature_items}
                </ul>
              </div>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="{action_link}"
                       style="display:inline-block;background:{accent_color};color:#FFFFFF;font-size:16px;font-weight:700;
                              text-decoration:none;padding:16px 44px;border-radius:10px;letter-spacing:0.3px;
                              box-shadow:0 4px 14px rgba(79,70,229,0.35);">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Instructions Box -->
              <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#166534;">
                  How to complete your account setup:
                </p>
                <ol style="margin:0;padding-left:20px;color:#166534;font-size:13px;line-height:1.7;">
                  <li>Click the <strong>"Accept Invitation"</strong> button above.</li>
                  <li>Verify your email address and activate your account.</li>
                  <li>Create and set your secure account password.</li>
                  <li>You will automatically be routed to the <strong>{portal_name}</strong>.</li>
                  <li>Sign in anytime using your email address and password.</li>
                </ol>
              </div>

              <!-- Expiration Notice -->
              <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#C2410C;line-height:1.5;">
                  <strong>Note:</strong> This invitation link is valid for <strong>7 days</strong>. If it expires, please request a new invitation from your administrator.
                </p>
              </div>

              <!-- Fallback Link -->
              <p style="color:#94A3B8;font-size:12px;line-height:1.5;margin:0 0 6px;">
                If the button above does not open, copy and paste this link into your web browser:
              </p>
              <p style="word-break:break-all;font-size:12px;color:{accent_color};margin:0 0 8px;">
                {action_link}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F8FAFC;padding:24px 40px;border-top:1px solid #E2E8F0;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;">
                This invitation was sent from <strong>{settings.EMAIL_FROM_NAME}</strong> to <strong>{recipient_email}</strong>.
              </p>
              <p style="margin:0;font-size:12px;color:#94A3B8;">
                &copy; DataCaliper Training Platform. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    def _render_invitation_plain(
        self,
        recipient_email: str,
        role: str,
        action_link: str,
        invited_by_name: str,
    ) -> str:
        is_instructor = role.upper() == "INSTRUCTOR"
        role_title = "INSTRUCTOR" if is_instructor else "Standard Learner"
        portal_name = "Instructor Portal" if is_instructor else "Learner Portal"

        if is_instructor:
            features = """- Create courses (Author rich, multi-module curriculums)
- Build modules and lessons (Structure video, text, and materials)
- Create assessments (Configure quizzes and exam gates)
- Review AI-generated quiz drafts (Curate AI-assisted questions)
- Publish courses (Launch approved courses to learners)"""
        else:
            features = """- Discover courses (Explore tailored courses across domains)
- Enroll in courses (Join structured curriculums with progress tracking)
- Complete lessons (Study modular content at your own pace)
- Take assessments (Validate skills with quizzes and exams)
- Track learning progress (Monitor milestones across your journey)
- Earn certificates (Receive verified certificates upon completion)"""

        return f"""Hello,

You have been invited to join the DataCaliper Training Platform by {invited_by_name}.

YOUR ASSIGNED ROLE:
{role_title}

WHAT YOU CAN DO:
{features}

ACCEPT INVITATION & GET STARTED:
Please open the following link in your browser to activate your account:
{action_link}

HOW TO ACTIVATE:
1. Open the link above.
2. Verify your email address.
3. Create and set your account password.
4. You will automatically be routed to your {portal_name}.
5. Sign in anytime using your email and password.

NOTE: This invitation link is valid for 7 days.

---
DataCaliper Training Platform
Sent to: {recipient_email}
"""


# Singleton instance
email_service = EmailService()


def send_invitation_email(
    recipient_email: str,
    role: str,
    action_link: str,
    invited_by_name: str,
) -> Tuple[bool, Optional[str]]:
    """Helper function delegating to the email_service singleton."""
    return email_service.send_invitation(
        recipient_email=recipient_email,
        role=role,
        action_link=action_link,
        invited_by_name=invited_by_name,
    )
