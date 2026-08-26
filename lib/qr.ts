import QRCode from 'qrcode'

export async function joinQrDataUrl(joinUrl: string): Promise<string> {
  return QRCode.toDataURL(joinUrl, {
    width: 360,
    margin: 1,
    color: {
      dark: '#071018',
      light: '#e8f6ff',
    },
    errorCorrectionLevel: 'M',
  })
}

export function joinUrlFromBase(baseUrl: string): string {
  return new URL('/join', baseUrl.replace(/\/$/, '') + '/').toString()
}
