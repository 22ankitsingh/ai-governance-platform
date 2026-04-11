"""
Email Service — Sends resolution notifications via SMTP (Gmail / Outlook / any SMTP server).
Uses only Python stdlib: smtplib + email.mime. No third-party SDK required.

This module is intentionally non-blocking: every send is dispatched via
FastAPI BackgroundTasks so the API response is never delayed by SMTP I/O.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# HTML email template
# ---------------------------------------------------------------------------

def _build_resolution_email_html(
    citizen_name: str,
    issue_title: str,
    issue_description: str,
    issue_id: str,
    officer_name: Optional[str],
    resolution_notes: Optional[str],
    issue_url: str,
) -> str:
    """Return a rich-HTML email body for issue-resolved notification."""
    officer_row = f"""
        <tr>
          <td style="padding:8px 0;color:#94a3b8;font-size:13px;width:160px;">Assigned Officer</td>
          <td style="padding:8px 0;color:#e2e8f0;font-size:13px;font-weight:600;">{officer_name or "—"}</td>
        </tr>""" if officer_name else ""

    resolution_block = f"""
        <div style="margin:20px 0;padding:16px;background:#1e293b;border-left:4px solid #22c55e;border-radius:6px;">
          <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Resolution Notes</p>
          <p style="margin:0;color:#e2e8f0;font-size:14px;line-height:1.6;">{resolution_notes}</p>
        </div>""" if resolution_notes else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your Issue Has Been Resolved</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);
                        padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.15);
                          border-radius:50%;width:64px;height:64px;line-height:64px;
                          font-size:28px;margin-bottom:16px;">✅</div>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;
                          letter-spacing:-0.5px;">Issue Resolved</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">
                PrajaGov
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">

              <!-- Greeting -->
              <p style="margin:0 0 20px;color:#e2e8f0;font-size:16px;line-height:1.6;">
                Dear <strong>{citizen_name}</strong>,
              </p>
              <p style="margin:0 0 28px;color:#94a3b8;font-size:14px;line-height:1.7;">
                Great news! Your civic issue has been reviewed and marked as
                <strong style="color:#22c55e;">Resolved</strong> by our team.
                Please review the details below and verify the resolution.
              </p>

              <!-- Issue card -->
              <div style="background:#0f172a;border-radius:12px;padding:24px;margin-bottom:24px;">
                <p style="margin:0 0 4px;color:#64748b;font-size:11px;
                            text-transform:uppercase;letter-spacing:1.2px;">Issue Details</p>
                <h2 style="margin:8px 0 16px;color:#f1f5f9;font-size:18px;
                             font-weight:700;line-height:1.4;">{issue_title}</h2>

                <p style="margin:0 0 20px;color:#94a3b8;font-size:13px;line-height:1.7;">
                  {issue_description}
                </p>

                <table width="100%" cellpadding="0" cellspacing="0"
                       style="border-top:1px solid #1e293b;">
                  <tr>
                    <td style="padding:8px 0;color:#94a3b8;font-size:13px;width:160px;">Issue ID</td>
                    <td style="padding:8px 0;color:#e2e8f0;font-size:13px;
                                font-family:monospace;">{issue_id}</td>
                  </tr>
                  {officer_row}
                  <tr>
                    <td style="padding:8px 0;color:#94a3b8;font-size:13px;">Status</td>
                    <td style="padding:8px 0;">
                      <span style="display:inline-block;background:#14532d;color:#22c55e;
                                    padding:2px 12px;border-radius:20px;font-size:12px;
                                    font-weight:600;">✓ Resolved</span>
                    </td>
                  </tr>
                </table>
              </div>

              {resolution_block}

              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="{issue_url}"
                   style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);
                           color:#ffffff;text-decoration:none;padding:14px 36px;
                           border-radius:50px;font-size:15px;font-weight:600;
                           letter-spacing:0.3px;box-shadow:0 4px 20px rgba(79,70,229,0.4);">
                  View &amp; Verify Issue →
                </a>
              </div>

              <!-- Footer note -->
              <div style="border-top:1px solid #334155;padding-top:24px;margin-top:8px;">
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;text-align:center;">
                  Please verify if the issue has been resolved satisfactorily.<br/>
                  If you believe it has <em>not</em> been resolved, you can reopen it from the platform.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer bar -->
          <tr>
            <td style="background:#0f172a;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">
                © 2026 PrajaGov &nbsp;|&nbsp;
                <a href="{settings.FRONTEND_URL}" style="color:#6366f1;text-decoration:none;">
                  Visit Platform
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>"""


# ---------------------------------------------------------------------------
# Core send function (blocking — called inside a background task)
# ---------------------------------------------------------------------------

def send_resolution_email_sync(
    to_email: str,
    citizen_name: str,
    issue_title: str,
    issue_description: str,
    issue_id: str,
    officer_name: Optional[str],
    resolution_notes: Optional[str],
) -> None:
    """
    Synchronous SMTP send, designed to run inside FastAPI BackgroundTasks.

    Raises nothing — all errors are caught and logged so that the main
    issue-resolution flow is never interrupted.
    """
    if not settings.smtp_configured:
        logger.warning(
            "SMTP not configured — skipping resolution email for issue %s", issue_id
        )
        return

    issue_url = f"{settings.FRONTEND_URL}/dashboard/issues/{issue_id}"
    html_body = _build_resolution_email_html(
        citizen_name=citizen_name,
        issue_title=issue_title,
        issue_description=issue_description,
        issue_id=issue_id,
        officer_name=officer_name,
        resolution_notes=resolution_notes,
        issue_url=issue_url,
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Your Issue Has Been Resolved"
    msg["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    msg["To"] = to_email

    # Plain-text fallback
    plain_text = (
        f"Dear {citizen_name},\n\n"
        f"Your issue '{issue_title}' has been resolved.\n"
        f"Issue ID: {issue_id}\n"
        f"Officer: {officer_name or 'N/A'}\n"
        f"Resolution Notes: {resolution_notes or 'N/A'}\n\n"
        f"View & Verify: {issue_url}\n\n"
        f"Please verify if the issue has been resolved satisfactorily.\n\n"
        f"— PrajaGov"
    )
    msg.attach(MIMEText(plain_text, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    logger.info(
        "Sending resolution email via SMTP to %s for issue %s", to_email, issue_id
    )
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.sendmail(msg["From"], [to_email], msg.as_string())

        logger.info(
            "Email sent successfully to %s for issue %s", to_email, issue_id
        )
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Email failed for issue %s (recipient: %s): %s",
            issue_id,
            to_email,
            exc,
            exc_info=True,
        )
