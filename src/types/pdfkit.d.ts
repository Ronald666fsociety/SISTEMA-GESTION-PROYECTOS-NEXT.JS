declare module 'pdfkit' {
  interface PDFDocumentOptions {
    size?: [number, number] | string
    margin?: number
    info?: {
      Title?: string
      Author?: string
      Subject?: string
    }
    bufferPages?: boolean
  }

  interface TextOptions {
    width?: number
    align?: string
    underline?: boolean
    continued?: boolean
    indent?: number
    height?: number
    lineBreak?: boolean
    baseline?: string | number
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions)
    font(fontName: string, size?: number): this
    fontSize(size: number): this
    text(text: string, options?: TextOptions): this
    text(text: string, x: number, options?: TextOptions): this
    text(text: string, x: number, y: number, options?: TextOptions): this
    moveDown(lines?: number): this
    rect(x: number, y: number, width: number, height: number): this
    fill(color?: string): this
    fillColor(color: string): this
    fillAndStroke(fillColor?: string, strokeColor?: string): this
    strokeColor(color: string): this
    lineWidth(width: number): this
    lineCap(style: string): this
    stroke(): this
    moveTo(x: number, y: number): this
    lineTo(x: number, y: number): this
    addPage(options?: PDFDocumentOptions): this
    on(event: string, callback: (...args: any[]) => void): this
    pipe(destination: any): this
    end(): void
    page: { width: number; height: number; margins: { top: number; bottom: number; left: number; right: number } }
    y: number
    x: number
    bufferedPageRange: () => { start: number; count: number }
    switchToPage(pageNumber: number): this
  }

  export default PDFDocument
}
