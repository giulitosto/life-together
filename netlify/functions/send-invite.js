exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const { to, partnerName, inviterName, inviteUrl } = JSON.parse(event.body || '{}');
  if (!to || !inviteUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You have been invited to Relation-ship</title>
</head>
<body style="margin:0;padding:0;background:#F5F0E8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E8;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#FDFAF5;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#2C4A5A;padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:300;color:#FDFAF5;letter-spacing:0.02em;">
              <em>Relation</em>-ship
            </p>
            <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8FBCB0;">
              A Life Together programme
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1E2D35;line-height:1.7;">
              Hi ${partnerName || 'there'},
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#1E2D35;line-height:1.7;">
              <strong>${inviterName}</strong> has invited you to join them on Relation-ship, a self-guided couples programme for partners who want to know themselves and each other more deeply.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#1E2D35;line-height:1.7;">
              Click the button below to accept the invitation and set up your account. Your progress will be shared with ${inviterName} across Modules 2 and 3.
            </p>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
              <tr>
                <td style="background:#8FBCB0;border-radius:10px;">
                  <a href="${inviteUrl}" style="display:block;padding:14px 32px;font-size:15px;font-weight:500;color:#FDFAF5;text-decoration:none;letter-spacing:0.01em;">
                    Join Relation-ship
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:12px;color:#7A8D8A;line-height:1.6;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color:#8FBCB0;word-break:break-all;">${inviteUrl}</a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #EAE3D2;text-align:center;">
            <p style="margin:0;font-size:11px;color:#7A8D8A;line-height:1.6;">
              Relation-ship &nbsp;·&nbsp; A Life Together programme<br>
              <a href="mailto:hello@lifetogether.uk" style="color:#8FBCB0;text-decoration:none;">hello@lifetogether.uk</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Relation-ship <hello@lifetogether.uk>',
      to: [to],
      subject: `${inviterName} has invited you to Relation-ship`,
      html
    })
  });

  const data = await res.json();
  if (!res.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: data.message || 'Failed to send' }) };
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
