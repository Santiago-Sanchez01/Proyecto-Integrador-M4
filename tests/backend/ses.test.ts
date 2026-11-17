import { beforeEach, expect, it, vi } from 'vitest'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { createSesMailer } from '../../server/ses'

vi.mock('@aws-sdk/client-sesv2', () => ({ SESv2Client: vi.fn(), SendEmailCommand: vi.fn(class { input: unknown; constructor(input: unknown) { this.input = input } }) }))
const content = { subject: 'Workspace — Resumen de tus tareas', text: 'Tarea ñ 🎯', html: '<p>Tarea ñ 🎯</p>' }
beforeEach(() => vi.clearAllMocks())

it('usa Simple, texto y HTML UTF-8, remitente de servidor y un único destinatario', async () => {
  const send = vi.fn().mockResolvedValue({ MessageId: 'fake-message-id' })
  await createSesMailer('us-east-1', 'workspace@example.invalid', { send }).send('alice@example.invalid', content)
  expect(SESv2Client).not.toHaveBeenCalled()
  expect(send).toHaveBeenCalledOnce()
  expect(SendEmailCommand).toHaveBeenCalledWith({ FromEmailAddress: 'workspace@example.invalid', Destination: { ToAddresses: ['alice@example.invalid'] }, Content: { Simple: {
    Subject: { Data: content.subject, Charset: 'UTF-8' }, Body: { Text: { Data: content.text, Charset: 'UTF-8' }, Html: { Data: content.html, Charset: 'UTF-8' } },
  } } })
})

it('inicializa el cliente con región explícita, plazos y sin reintentos ni credenciales hardcodeadas', () => {
  createSesMailer('us-east-1', 'workspace@example.invalid')
  expect(SESv2Client).toHaveBeenCalledExactlyOnceWith({ region: 'us-east-1', maxAttempts: 1, requestHandler: { connectionTimeout: 3000, requestTimeout: 10_000, throwOnRequestTimeout: true } })
})

it.each(['MessageRejected', 'BadRequestException', 'MailFromDomainNotVerifiedException', 'AccountSuspendedException', 'SendingPausedException', 'TooManyRequestsException', 'LimitExceededException'])('normaliza rechazo SES %s sin detalles privados ni reintentos', async name => {
  const send = vi.fn().mockRejectedValue({ name, message: 'PRIVATE_KEY alice@example.invalid' })
  const error = await createSesMailer('us-east-1', 'sender@example.invalid', { send }).send('alice@example.invalid', content).catch(error => error)
  expect(error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', status: 503 })
  expect(String(error)).not.toMatch(/PRIVATE_KEY|alice@example/)
  expect(send).toHaveBeenCalledOnce()
})

it.each([new Error('private network failure'), { name: 'TimeoutError', message: 'private' }])('trata fallos ambiguos como resultado desconocido', async failure => {
  const send = vi.fn().mockRejectedValue(failure)
  await expect(createSesMailer('us-east-1', 'sender@example.invalid', { send }).send('alice@example.invalid', content)).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN' })
  expect(send).toHaveBeenCalledOnce()
})

it.each([{}, { MessageId: '' }, { MessageId: ' ' }])('no afirma aceptación sin MessageId: %j', async result => {
  await expect(createSesMailer('us-east-1', 'sender@example.invalid', { send: vi.fn().mockResolvedValue(result) }).send('alice@example.invalid', content)).rejects.toMatchObject({ code: 'SEND_STATUS_UNKNOWN' })
})
