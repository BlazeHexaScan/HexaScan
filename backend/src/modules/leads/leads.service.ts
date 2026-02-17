import nodemailer from 'nodemailer';
import { prisma } from '../../core/database/client.js';
import { config } from '../../config/index.js';
import { CreateLeadInput } from './leads.schema.js';

export class LeadsService {
  async createLead(input: CreateLeadInput) {
    const lead = await prisma.lead.create({
      data: {
        name: input.name,
        email: input.email,
        company: input.company,
        plan: input.plan,
        message: input.message,
      },
    });

    // Send notification email in the background (don't block the response)
    this.sendNotificationEmail(lead).catch((err) => {
      console.error('[Leads] Failed to send notification email:', err.message);
    });

    return lead;
  }

  private async sendNotificationEmail(lead: {
    name: string;
    email: string;
    company: string | null;
    plan: string | null;
    message: string | null;
    createdAt: Date;
  }) {
    const { host, port, user, password, secure, fromAddress, fromName } = config.smtp;

    if (!host || !user || !password || !fromAddress) {
      console.warn('[Leads] SMTP not configured, skipping notification email.');
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure || port === 465,
      auth: { user, pass: password },
    });

    const subject = `New Lead: ${lead.name} - ${lead.plan || 'No plan specified'}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">New Lead Received</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 100px;">Name:</td>
              <td style="padding: 8px 0; color: #111827;">${lead.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
              <td style="padding: 8px 0; color: #111827;"><a href="mailto:${lead.email}">${lead.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Company:</td>
              <td style="padding: 8px 0; color: #111827;">${lead.company || '-'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Plan:</td>
              <td style="padding: 8px 0; color: #111827;">${lead.plan || '-'}</td>
            </tr>
          </table>
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
            <p style="font-weight: bold; color: #374151; margin-bottom: 8px;">Message:</p>
            <p style="color: #111827; white-space: pre-wrap;">${lead.message || '-'}</p>
          </div>
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
            Received at ${lead.createdAt.toISOString()}
          </div>
        </div>
      </div>
    `.trim();

    const textContent = `New Lead Received\n\nName: ${lead.name}\nEmail: ${lead.email}\nCompany: ${lead.company || '-'}\nPlan: ${lead.plan || '-'}\n\nMessage:\n${lead.message || '-'}`;

    const info = await transporter.sendMail({
      from: `"${fromName || 'HexaScan'}" <${fromAddress}>`,
      to: 'support@hexascan.app',
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[Leads] Notification email sent: ${info.messageId}`);
  }
}
