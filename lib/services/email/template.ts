/**
 * Email Template
 *
 * Single base template for all transactional emails.
 * Inject content via EmailTemplateData — heading, body HTML, and optional CTA button.
 *
 * Brand colours:
 *   Navy  #1e2a4a — header, footer, headings
 *   Teal  #06b6d4 — CTA buttons
 *   Light #f1f5f9 — page background
 */

export interface EmailTemplateData {
  /** Short preview shown in email client inbox (not visible in body) */
  preheader?: string;
  /** Main heading inside the white card */
  heading: string;
  /** HTML to inject into the body of the card */
  body: string;
  /** CTA button label (omit to skip the button) */
  ctaText?: string;
  /** CTA button href (omit to skip the button) */
  ctaUrl?: string;
}

export function renderEmailTemplate(data: EmailTemplateData, appUrl: string): string {
  const logoUrl = `${appUrl}/images/branding/codesalvage_logo_email.png`;
  const currentYear = new Date().getFullYear();
  const preheader = data.preheader ?? data.heading;

  const ctaButton =
    data.ctaText && data.ctaUrl
      ? `
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 12px;">
      <tr>
        <td align="center">
          <a href="${data.ctaUrl}"
             style="display:inline-block;background:#06b6d4;color:#ffffff;font-family:Arial,sans-serif;
                    font-size:16px;font-weight:bold;text-decoration:none;padding:14px 32px;
                    border-radius:6px;letter-spacing:0.3px;">
            ${data.ctaText}
          </a>
        </td>
      </tr>
    </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${data.heading}</title>
  <!--[if !mso]><!-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-wrapper { width: 100% !important; padding: 0 !important; }
      .email-card   { border-radius: 0 !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">

  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:#f1f5f9;font-size:1px;">
    ${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f1f5f9">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Outer wrapper (max 600px) -->
        <table class="email-wrapper" width="600" border="0" cellspacing="0" cellpadding="0"
               style="max-width:600px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td align="center" bgcolor="#1e2a4a"
                style="padding: 28px 40px; border-radius: 8px 8px 0 0;">
              <a href="${appUrl}" style="text-decoration:none;">
                <img src="${logoUrl}" alt="CodeSalvage"
                     width="240" height="57"
                     style="display:block;border:0;max-width:240px;height:auto;" />
              </a>
            </td>
          </tr>

          <!-- ── Body card ── -->
          <tr>
            <td class="email-card" bgcolor="#ffffff"
                style="padding: 40px 48px 32px; border-radius: 0 0 8px 8px;">

              <h1 style="margin:0 0 20px;color:#1e2a4a;font-size:24px;font-weight:700;
                          line-height:1.3;letter-spacing:-0.3px;">
                ${data.heading}
              </h1>

              <div style="color:#374151;font-size:15px;line-height:1.7;">
                ${data.body}
              </div>

              ${ctaButton}

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td align="center" style="padding: 24px 16px 8px;">
              <p style="margin:0 0 6px;color:#64748b;font-size:13px;">
                &copy; ${currentYear} CodeSalvage &mdash; Marketplace for Incomplete Software Projects
              </p>
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                <a href="${appUrl}" style="color:#06b6d4;text-decoration:none;">codesalvage.com</a>
                &nbsp;&middot;&nbsp;
                <a href="${appUrl}/support" style="color:#06b6d4;text-decoration:none;">Support</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}
