import { chromium } from 'playwright';

interface PdfRenderOptions {
  headerTemplate?: string;
  footerTemplate?: string;
}

export async function renderPdfFromHtml(html: string, options: PdfRenderOptions = {}): Promise<Buffer> {
  const launchArgs = process.env.PLAYWRIGHT_DISABLE_SANDBOX === 'true'
    ? ['--no-sandbox', '--disable-setuid-sandbox']
    : [];

  const browser = await chromium.launch({ args: launchArgs });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      displayHeaderFooter: Boolean(options.headerTemplate || options.footerTemplate),
      headerTemplate: options.headerTemplate || '<div></div>',
      footerTemplate: options.footerTemplate || '<div></div>',
      margin: {
        top: options.headerTemplate ? '90px' : '40px',
        bottom: options.footerTemplate ? '80px' : '40px',
        left: '40px',
        right: '40px',
      },
    });

    await page.close();
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
