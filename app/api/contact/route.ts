import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { getContactEmailTemplate, getUserConfirmationEmailTemplate } from '@/lib/emails/contact-template';
import { extractEmailAddress } from '@/lib/emails/email-config';

interface ContactEmailPayload {
  name: string;
  email: string;
  adminEmail: string;
  adminSubject: string;
  adminText: string;
  adminHtml: string;
  userSubject: string;
  userHtml: string;
}

async function sendWithResend(apiKey: string, fromEmail: string, payload: ContactEmailPayload) {
  const resend = new Resend(apiKey);
  const resendInboxEmail = extractEmailAddress(fromEmail);
  const adminRecipients = Array.from(new Set([payload.adminEmail, resendInboxEmail].filter(Boolean)));

  const [adminRes, userRes] = await Promise.all([
    resend.emails.send({
      from: fromEmail,
      to: adminRecipients,
      replyTo: payload.email,
      subject: payload.adminSubject,
      text: payload.adminText,
      html: payload.adminHtml,
    }),
    resend.emails.send({
      from: fromEmail,
      to: payload.email,
      subject: payload.userSubject,
      html: payload.userHtml,
    }),
  ]);

  if (adminRes.error) {
    throw new Error(`Resend admin email failed: ${adminRes.error.message}`);
  }
  if (userRes.error) {
    throw new Error(`Resend confirmation email failed: ${userRes.error.message}`);
  }
}

async function sendWithNodemailer(user: string, pass: string, payload: ContactEmailPayload) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await Promise.all([
    transporter.sendMail({
      from: user,
      to: payload.adminEmail,
      replyTo: payload.email,
      subject: payload.adminSubject,
      text: payload.adminText,
      html: payload.adminHtml,
    }),
    transporter.sendMail({
      from: user,
      to: payload.email,
      subject: payload.userSubject,
      html: payload.userHtml,
    }),
  ]);
}

export async function POST(req: Request) {
  let isEn = false;
  try {
    const { name, email, subject, message, locale } = await req.json();
    isEn = locale === 'en';

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: isEn ? 'All required fields must be filled.' : 'جميع الحقول المطلوبة يجب أن تكون ممتلئة.' },
        { status: 400 }
      );
    }

    const adminEmail = process.env.EMAIL?.trim();
    if (!adminEmail) {
      throw new Error('EMAIL environment variable is not configured');
    }

    const payload: ContactEmailPayload = {
      name,
      email,
      adminEmail,
      adminSubject: `رسالة جديدة من الموقع: ${subject || 'بدون عنوان'}`,
      adminText: `
        الاسم: ${name}
        البريد الإلكتروني: ${email}
        الرسالة:
        ${message}
      `,
      adminHtml: getContactEmailTemplate({ name, email, subject, message }),
      userSubject: 'استلمنا رسالتك - فريق الدعم',
      userHtml: getUserConfirmationEmailTemplate({ name }),
    };

    const resendApiKey = process.env.RESEND_API_KEY?.trim();
    const resendFromEmail = process.env.RESEND_FROM_EMAIL?.trim();
    const gmailPassword = process.env.PASSWORD?.trim();

    let sent = false;

    if (resendApiKey && resendFromEmail) {
      try {
        await sendWithResend(resendApiKey, resendFromEmail, payload);
        sent = true;
      } catch (resendError) {
        console.error('Resend failed, falling back to Gmail SMTP:', resendError);
      }
    }

    if (!sent) {
      if (!gmailPassword) {
        throw new Error('Fallback Gmail PASSWORD environment variable is not configured');
      }
      await sendWithNodemailer(adminEmail, gmailPassword, payload);
    }

    return NextResponse.json({ success: true, message: isEn ? 'Message sent successfully' : 'تم إرسال الرسالة بنجاح' });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { error: isEn ? 'An error occurred while sending your message. Please try again later.' : 'حدث خطأ أثناء إرسال الرسالة. حاول مرة أخرى لاحقاً.' },
      { status: 500 }
    );
  }
}
