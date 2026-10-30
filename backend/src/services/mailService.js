const SMTP_URL = process.env.SMTP_URL || '';
const MAIL_FROM = process.env.MAIL_FROM || 'CinéSlot <no-reply@cineslot.test>';

if (!SMTP_URL && process.env.NODE_ENV === 'production') {
  throw new Error('SMTP_URL environment variable is required in production');
}

let transporterPromise = null;

function getTransporter() {
  // Lazy import: nodemailer is only needed when SMTP_URL is set.
  transporterPromise ??= import('nodemailer').then((m) => m.default.createTransport(SMTP_URL));
  return transporterPromise;
}

export async function sendPasswordResetEmail(to, link) {
  if (!SMTP_URL) {
    console.info(`[Mail] SMTP_URL absent, lien de réinitialisation pour ${to} : ${link}`);
    return;
  }
  const transporter = await getTransporter();
  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Réinitialisation de votre mot de passe CinéSlot',
    text: `Bonjour,\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable 30 minutes) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`
  });
}
