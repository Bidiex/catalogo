import { jsPDF } from 'jspdf';

/**
 * Generates a PDF invoice for an order.
 * @param {Object} order - The order object including items and customer details.
 * @param {Object} business - The business object including logo and address.
 */
export const generateOrderInvoice = async (order, business) => {
    // 1. Setup PDF (80mm width typical for receipts, auto height would be ideal but jsPDF needs explicit)
    // We'll estimate height first or use a long page and let the printer handle it (or A4 column).
    // Given "impresoras lasers", we can use A4 but draw in a centered column, or just use a small page size.
    // User said "tirillas... impresoras lasers". A small page size (80mm x 200mm+) is often best as it can be printed on A4 (centered) or receipt printers.

    // Let's calculate estimated height
    const baseHeight = 100; // Header + Footer
    const itemHeight = 10; // Per item approx
    const itemsCount = order.items ? order.items.length : 0;
    const estimatedHeight = baseHeight + (itemsCount * itemHeight) + 60; // Extra buffer

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, estimatedHeight] // 80mm width, dynamic height
    });

    const pageWidth = 80;
    const margin = 5;
    const contentWidth = pageWidth - (margin * 2);
    let y = 10; // Current Y position

    // Helper for centering text
    const centerText = (text, yPos, fontSize = 10, fontStyle = 'normal') => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', fontStyle);
        const textWidth = doc.getTextWidth(text);
        const x = (pageWidth - textWidth) / 2;
        doc.text(text, x, yPos);
    };

    // Helper for left-right text
    const rowText = (label, value, yPos, fontSize = 8, boldLabel = false) => {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', boldLabel ? 'bold' : 'normal');
        doc.text(label, margin, yPos);

        doc.setFont('helvetica', 'normal');
        const valStr = String(value);
        const valWidth = doc.getTextWidth(valStr);
        doc.text(valStr, pageWidth - margin - valWidth, yPos);
    };

    // --- HEADER ---

    // Logo (if exists) via URL
    // Note: jsPDF needs base64 or image data. Fetching URL client-side might run into CORS if not configured.
    // We'll try to add it if we can fetcth it, otherwise skip or use placeholder text.
    if (business.logo_url) {
        try {
            // Attempt to load image
            // This requires the storage bucket to allow CORS for the domain
            const img = await loadImage(business.logo_url);
            if (img) {
                // Keep aspect ratio, max width 40mm, max height 20mm
                const ratio = img.width / img.height;
                let w = 30;
                let h = w / ratio;
                if (h > 20) {
                    h = 20;
                    w = h * ratio;
                }
                const x = (pageWidth - w) / 2;
                doc.addImage(img, 'JPEG', x, y, w, h);
                y += h + 5;
            }
        } catch (e) {
            console.warn('Could not load logo for PDF', e);
            // Fallback: Just Business Name (handled below)
        }
    }

    // Business Info
    centerText(business.name || 'Mi Negocio', y, 12, 'bold');
    y += 5;

    if (business.address) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        // Wrap address if too long
        const splitAddr = doc.splitTextToSize(business.address, contentWidth);
        doc.text(splitAddr, pageWidth / 2, y, { align: 'center' });
        y += (splitAddr.length * 4);
    }

    if (business.whatsapp || business.phone) {
        centerText(`Tel: ${business.whatsapp || business.phone}`, y, 8);
        y += 6;
    }

    // Divider
    doc.setDrawColor(200, 200, 200); // Gray
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Invoice Meta
    centerText('FACTURA DE VENTA', y, 10, 'bold');
    y += 5;

    // Serial use 'invoice_serial' if available, else fallback to short ID
    // The field 'invoice_serial' should come from the DB query (needs to be added to select)
    const serial = order.invoice_serial || `REF-${order.id.slice(0, 8).toUpperCase()}`;
    centerText(`No: ${serial}`, y, 10, 'bold');
    y += 6;

    centerText(`Fecha: ${new Date(order.created_at).toLocaleString()}`, y, 8);
    y += 8;

    // Customer
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.text(order.customer_name || 'Consumidor Final', margin, y);
    y += 4;
    if (order.customer_phone) {
        doc.text(`Tel: ${order.customer_phone}`, margin, y);
        y += 4;
    }
    if (order.customer_address) {
        const splitCustAddr = doc.splitTextToSize(order.customer_address, contentWidth);
        doc.text(splitCustAddr, margin, y);
        y += (splitCustAddr.length * 4);
    }

    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // --- ITEMS ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Cant.', margin, y);
    doc.text('Producto', margin + 8, y);
    doc.text('Total', pageWidth - margin - 10, y);
    y += 4;

    doc.setFont('helvetica', 'normal');

    order.items.forEach(item => {
        const quantity = item.quantity.toString();
        // Product Line
        const price = parseFloat(item.total_price).toLocaleString();

        doc.text(quantity, margin + 2, y, { align: 'center' });

        // Wrap product name
        const maxNameWidth = contentWidth - 25; // Space for qty and price
        const splitName = doc.splitTextToSize(item.product_name, maxNameWidth);
        doc.text(splitName, margin + 8, y);

        // Price aligned right
        const priceWidth = doc.getTextWidth(price);
        doc.text(price, pageWidth - margin - priceWidth, y);

        let currentLineHeight = splitName.length * 4;

        // Options (Sides/Variations)
        if (item.options) {
            let optsText = [];
            if (item.options.size) optsText.push(`Tamaño: ${item.options.size.name}`);
            if (item.options.sides && item.options.sides.length) optsText.push(`+ ${item.options.sides.map(s => s.name).join(', ')}`);
            if (item.options.quickComment) optsText.push(`Nota: ${item.options.quickComment.name}`);

            if (optsText.length > 0) {
                doc.setFontSize(7);
                doc.setTextColor(100, 100, 100); // Gray for options
                const optsStr = optsText.join(' | ');
                const splitOpts = doc.splitTextToSize(optsStr, maxNameWidth);
                doc.text(splitOpts, margin + 8, y + currentLineHeight);
                currentLineHeight += (splitOpts.length * 3.5);
                doc.setFontSize(8);
                doc.setTextColor(0, 0, 0); // Black
            }
        }

        y += currentLineHeight + 2;
    });

    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // --- TOTALS ---
    const subtotal = parseFloat(order.total_amount) - parseFloat(order.delivery_price);

    rowText('Subtotal:', `$${subtotal.toLocaleString()}`, y);
    y += 5;

    if (parseFloat(order.delivery_price) > 0) {
        rowText('Domicilio:', `$${parseFloat(order.delivery_price).toLocaleString()}`, y);
        y += 5;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    rowText('TOTAL:', `$${parseFloat(order.total_amount).toLocaleString()}`, y, 10, true);
    y += 8;

    // --- FOOTER ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    centerText(`Método de Pago: ${order.payment_method}`, y, 8, 'bold');
    y += 6;

    centerText('¡Gracias por tu compra!', y, 8, 'italic');
    y += 5;
    centerText('Generado por TraeGo', y, 7, 'italic'); // Branding subtle

    // Save
    doc.save(`Factura_${serial}.pdf`);
};

// Helper to load image for texture
const loadImage = (url) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};
