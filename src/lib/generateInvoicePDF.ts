import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface InvoiceLineItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceData {
  invoice_number: string | null;
  amount: number;
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  due_date: string | null;
  created_at: string;
  notes: string | null;
}

interface AgencyData {
  name: string;
  logo_url: string | null;
  business_name: string | null;
  business_address: string | null;
  tax_id: string | null;
  invoice_footer: string | null;
}

interface ClientData {
  full_name: string | null;
  email: string;
}

interface ProjectData {
  title: string;
}

interface PaymentMethodData {
  name: string;
  details: string;
}

interface GeneratePDFParams {
  invoice: InvoiceData;
  agency: AgencyData;
  client: ClientData;
  project: ProjectData | null;
  paymentMethod: PaymentMethodData | null;
  lineItems: InvoiceLineItem[];
  isFreePlan?: boolean;
}

export async function generateInvoicePDF({
  invoice,
  agency,
  client,
  project,
  paymentMethod,
  lineItems,
  isFreePlan = false,
}: GeneratePDFParams): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // Colors
  const primaryColor: [number, number, number] = [16, 185, 129]; // Emerald
  const textColor: [number, number, number] = [30, 30, 30];
  const mutedColor: [number, number, number] = [120, 120, 120];

  // Helper function to load image as base64
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Add logo if available
  if (agency.logo_url) {
    try {
      const logoBase64 = await loadImageAsBase64(agency.logo_url);
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', margin, yPos, 30, 30);
        yPos += 5;
      }
    } catch (e) {
      console.error('Error loading logo:', e);
    }
  }

  // Header - Agency info
  doc.setFontSize(20);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(agency.business_name || agency.name, agency.logo_url ? margin + 35 : margin, yPos + 8);

  // Invoice number on the right
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text(invoice.invoice_number || 'INVOICE', pageWidth - margin, yPos + 8, { align: 'right' });

  yPos += 20;

  // Agency details
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.setFont('helvetica', 'normal');
  
  if (agency.business_address) {
    const addressLines = agency.business_address.split('\n');
    addressLines.forEach((line) => {
      doc.text(line, margin, yPos);
      yPos += 4;
    });
  }
  
  if (agency.tax_id) {
    doc.text(`Tax ID: ${agency.tax_id}`, margin, yPos);
    yPos += 4;
  }

  yPos += 10;

  // Separator line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Two column layout for dates and bill to
  // Left column - Invoice dates
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('Invoice Date:', margin, yPos);
  doc.setTextColor(...textColor);
  doc.text(new Date(invoice.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }), margin + 30, yPos);

  if (invoice.due_date) {
    yPos += 6;
    doc.setTextColor(...mutedColor);
    doc.text('Due Date:', margin, yPos);
    doc.setTextColor(...textColor);
    doc.text(new Date(invoice.due_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }), margin + 30, yPos);
  }

  // Right column - Bill To
  const rightCol = pageWidth / 2 + 10;
  let rightYPos = yPos - (invoice.due_date ? 6 : 0);
  
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('Bill To:', rightCol, rightYPos);
  rightYPos += 6;
  
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(client.full_name || client.email.split('@')[0], rightCol, rightYPos);
  rightYPos += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(client.email, rightCol, rightYPos);

  if (project) {
    rightYPos += 5;
    doc.text(`Project: ${project.title}`, rightCol, rightYPos);
  }

  yPos += 20;

  // Line Items Table
  if (lineItems.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Qty', 'Rate', 'Amount']],
      body: lineItems.map(item => [
        item.description,
        item.quantity.toString(),
        `$${Number(item.rate).toFixed(2)}`,
        `$${Number(item.amount).toFixed(2)}`
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: mutedColor,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        textColor: textColor,
        fontSize: 10,
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Totals
    const totalsX = pageWidth - margin - 60;
    
    doc.setFontSize(10);
    doc.setTextColor(...mutedColor);
    doc.text('Subtotal:', totalsX, yPos);
    doc.setTextColor(...textColor);
    doc.text(`$${Number(invoice.subtotal || 0).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });

    if (Number(invoice.tax_rate) > 0) {
      yPos += 6;
      doc.setTextColor(...mutedColor);
      doc.text(`Tax (${invoice.tax_rate}%):`, totalsX, yPos);
      doc.setTextColor(...textColor);
      doc.text(`$${Number(invoice.tax_amount || 0).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
    }

    yPos += 8;
    doc.setDrawColor(200, 200, 200);
    doc.line(totalsX - 10, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Total:', totalsX, yPos);
    doc.setTextColor(...primaryColor);
    doc.text(`$${Number(invoice.amount).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
  } else {
    // Legacy invoice without line items
    doc.setFontSize(12);
    doc.setTextColor(...mutedColor);
    doc.text('Amount Due:', margin, yPos);
    yPos += 8;
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`$${Number(invoice.amount).toLocaleString()}`, margin, yPos);
  }

  yPos += 20;

  // Payment Method
  if (paymentMethod) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(`Payment Method: ${paymentMethod.name}`, margin, yPos);
    yPos += 6;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    const detailLines = paymentMethod.details.split('\n');
    detailLines.forEach((line) => {
      doc.text(line, margin, yPos);
      yPos += 4;
    });
    yPos += 6;
  }

  // Notes
  if (invoice.notes) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Notes:', margin, yPos);
    yPos += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(noteLines, margin, yPos);
    yPos += noteLines.length * 4 + 6;
  }

  // Footer - Legal terms
  if (agency.invoice_footer) {
    // Draw footer at bottom of page
    const footerY = doc.internal.pageSize.getHeight() - 30;
    
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    const footerLines = doc.splitTextToSize(agency.invoice_footer, pageWidth - margin * 2);
    doc.text(footerLines, margin, footerY);
  }

  // Powered by Veylodesk (free plan)
  if (isFreePlan) {
    const brandY = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text('Powered by Veylodesk — veylodesk.com', pageWidth / 2, brandY, { align: 'center' });
  }

  return doc.output('blob');
}

export function downloadInvoicePDF(blob: Blob, invoiceNumber: string | null) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${invoiceNumber || 'Invoice'}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
