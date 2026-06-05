"""Send course-share emails via AWS SES SMTP.

POC-grade: single configured sender, no queue, no retries, no bounce handling.

Env vars (all required):
  SES_FROM             "Display <addr>"  e.g. 'CourseBuilder <noreply@yourdomain.com>'
  AWS_SMTP_USERNAME    SES SMTP credentials (NOT IAM keys). Generate in
  AWS_SMTP_PASSWORD    SES console → SMTP settings → Create SMTP credentials.
  AWS_SES_SMTP_HOST    (default: email-smtp.us-west-2.amazonaws.com)
  AWS_SES_SMTP_PORT    (default: 2587 — works on Cloud Run, AWS, and locally.
                       Override to 587 only on networks that block non-standard
                       outbound ports.)
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class EmailNotConfigured(Exception):
    pass


class EmailSendError(Exception):
    pass


def send_share_email(
    to_email: str,
    course_title: str,
    course_url: str,
    note: str = "",
) -> None:
    sender   = os.getenv("SES_FROM")
    username = os.getenv("AWS_SMTP_USERNAME")
    password = os.getenv("AWS_SMTP_PASSWORD")
    if not sender:
        raise EmailNotConfigured(
            "SES_FROM must be set in backend/.env (e.g. 'CourseBuilder <noreply@yourdomain.com>')"
        )
    if not username or not password:
        raise EmailNotConfigured(
            "AWS_SMTP_USERNAME and AWS_SMTP_PASSWORD must be set in backend/.env"
        )

    host = os.getenv("AWS_SES_SMTP_HOST", "email-smtp.us-west-2.amazonaws.com")
    port = int(os.getenv("AWS_SES_SMTP_PORT", "2587"))

    msg = MIMEMultipart("alternative")
    msg["From"]    = sender
    msg["To"]      = to_email
    msg["Subject"] = f"You've been invited to a course: {course_title}"
    msg.attach(MIMEText(_render_text(course_title, course_url, note), "plain"))
    msg.attach(MIMEText(_render_html(course_title, course_url, note), "html"))

    try:
        logger.info("SES SMTP → %s:%s, to=%s", host, port, to_email)
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(username, password)
            server.send_message(msg)
    except smtplib.SMTPAuthenticationError as e:
        raise EmailSendError(
            "SES SMTP authentication failed. Verify AWS_SMTP_USERNAME and "
            "AWS_SMTP_PASSWORD are SES SMTP credentials (not IAM keys)."
        ) from e
    except smtplib.SMTPRecipientsRefused as e:
        raise EmailSendError(
            "SES rejected the recipient. If your account is in sandbox mode, "
            "the recipient address must be verified in the SES console."
        ) from e
    except smtplib.SMTPSenderRefused as e:
        raise EmailSendError(
            "SES rejected the sender. Verify the sending identity in the SES console."
        ) from e
    except Exception as e:
        raise EmailSendError(f"SES SMTP send failed: {e}") from e


def _render_text(course_title: str, course_url: str, note: str) -> str:
    note_block = f"{note.strip()}\n\n" if note and note.strip() else ""
    return (
        f"Hi,\n\n"
        f"{note_block}"
        f"You've been invited to take the course \"{course_title}\".\n\n"
        f"Start here:\n{course_url}\n\n"
        f"— Sent via CourseBuilder\n"
    )


def _render_html(course_title: str, course_url: str, note: str) -> str:
    note_html = (
        f"<p style='white-space:pre-wrap;color:#374151'>{_escape(note.strip())}</p>"
        if note and note.strip() else ""
    )
    return f"""\
<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;
                   background:#faf8f3;padding:24px;color:#111827">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;
              border-radius:14px;padding:28px">
    <div style="height:4px;background:linear-gradient(to right,#fb923c,#ea580c);
                border-radius:2px;margin-bottom:20px"></div>
    <h2 style="margin:0 0 8px;font-size:20px">You've been invited to a course</h2>
    <h3 style="margin:0 0 16px;font-size:16px;color:#ea580c">{_escape(course_title)}</h3>
    {note_html}
    <p style="margin:16px 0 24px;color:#374151">
      Click below to start learning. Your progress is saved automatically in your browser.
    </p>
    <a href="{_escape(course_url)}"
       style="display:inline-block;padding:10px 18px;background:#ea580c;color:#fff;
              text-decoration:none;border-radius:8px;font-weight:600">
      Open the course
    </a>
    <p style="margin-top:28px;font-size:12px;color:#6b7280">
      If the button doesn't work, paste this link into your browser:<br>
      <span style="word-break:break-all">{_escape(course_url)}</span>
    </p>
  </div>
</body></html>"""


def _escape(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;")
             .replace(">", "&gt;").replace('"', "&quot;"))
