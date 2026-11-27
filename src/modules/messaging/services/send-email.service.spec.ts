import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { SendEmailService } from './send-email.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('SendEmailService', () => {
  const sendMail = jest.fn();
  const config = { getOrThrow: jest.fn((key: string) => ({ SMTP_HOST:'smtp.test', SMTP_PORT:'465', SMTP_SECURE:'true', SMTP_USER:'user', SMTP_PASS:'pass', SMTP_FROM:'sender@example.test' })[key]) };
  let service: SendEmailService;

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({ accepted:['recipient@example.test'] });
    service = new SendEmailService(config as unknown as ConfigService);
  });

  it('sends sanitized caller content, substitutes values, and uses configured sender', async () => {
    const result = await service.execute({ to:'recipient@example.test', subject:'Verify', html:'<table><tr><td>{{code}}</td></tr><script>alert(1)</script></table>', values:{ code:'<123>' } });
    expect(result.accepted).toEqual(['recipient@example.test']);
    expect(sendMail.mock.calls[0][0].from).toBe('sender@example.test');
    expect(sendMail.mock.calls[0][0].html).toContain('&lt;123&gt;');
    expect(sendMail.mock.calls[0][0].html).not.toContain('<script>');
  });

  it('rejects unsafe link placeholders and unknown placeholders', async () => {
    await expect(service.execute({ to:'a@b.test', subject:'x', html:'<a href="{{link}}">go</a>', values:{link:'javascript:alert(1)'} })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.execute({ to:'a@b.test', subject:'x', html:'{{unknown}}' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects oversized bodies and subject header injection', async () => {
    await expect(service.execute({ to:'a@b.test', subject:'ok', html:'x'.repeat(65537) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.execute({ to:'a@b.test', subject:'ok\r\nBcc:evil@b.test', html:'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires complete SMTP settings during provider construction', () => {
    const broken = { getOrThrow: jest.fn((key: string) => key === 'SMTP_PASS' ? undefined : config.getOrThrow(key)) };
    expect(() => new SendEmailService(broken as unknown as ConfigService)).toThrow();
  });

  it('surfaces SMTP failures without logging content', async () => {
    sendMail.mockRejectedValue(new Error('SMTP unavailable'));
    await expect(service.execute({ to:'a@b.test', subject:'ok', html:'body' })).rejects.toThrow('SMTP unavailable');
  });
});
