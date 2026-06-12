import { Injectable, inject } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LoggerService } from './logger.service';

export interface ExportOptions {
  filename?: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter';
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private logger = inject(LoggerService);

  /**
   * Exporta datos a Excel (.xlsx)
   */
  exportToExcel(data: any[], filename: string = 'export', sheetName: string = 'Hoja1'): void {
    try {
      if (!data || data.length === 0) {
        console.warn('No hay datos para exportar');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${filename}.xlsx`);
      
      console.log('✅ Excel exportado exitosamente');
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      // Fallback a CSV si falla Excel
      this.exportToCSV(data, filename);
    }
  }

  /**
   * Exporta datos a CSV
   */
  exportToCSV(data: any[], filename: string = 'export'): void {
    if (!data || data.length === 0) {
      console.warn('No hay datos para exportar');
      return;
    }

    try {
      // Obtener headers
      const headers = Object.keys(data[0]);
      
      // Crear CSV
      let csv = headers.join(',') + '\n';
      
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // Escapar comas y comillas
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csv += values.join(',') + '\n';
      });

      // Crear blob y descargar
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ CSV exportado exitosamente');
    } catch (error) {
      console.error('Error exportando CSV:', error);
    }
  }

  /**
   * Exporta datos a PDF con tabla
   */
  exportToPDF(
    data: any[], 
    columns: { header: string, dataKey: string }[],
    options: ExportOptions = {}
  ): void {
    try {
      if (!data || data.length === 0) {
        alert('No hay datos para exportar a PDF');
        return;
      }

      console.log('Generando PDF con:', { data, columns, options });

      const doc = new jsPDF({
        orientation: options.orientation || 'portrait',
        unit: 'mm',
        format: options.pageSize || 'a4'
      });

      // Título
      const title = options.title || 'Reporte';
      doc.setFontSize(18);
      doc.setTextColor(28, 25, 23); // stone-900
      doc.text(title, 14, 20);
      
      // Subtítulo con fecha
      doc.setFontSize(10);
      doc.setTextColor(120, 113, 108); // stone-500
      const dateStr = new Date().toLocaleString('es-PE', { 
        dateStyle: 'full', 
        timeStyle: 'short' 
      });
      doc.text(`Generado: ${dateStr}`, 14, 27);

      // Preparar datos de la tabla
      const tableData = data.map(row => 
        columns.map(col => {
          const value = row[col.dataKey];
          // Convertir a string y manejar valores undefined/null
          return value !== undefined && value !== null ? String(value) : '';
        })
      );

      console.log('Datos de tabla:', { headers: columns.map(c => c.header), rows: tableData.length });

      // Tabla
      autoTable(doc, {
        startY: 35,
        head: [columns.map(col => col.header)],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: [28, 25, 23], // stone-900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'left'
        },
        styles: { 
          fontSize: 9,
          cellPadding: 3,
          overflow: 'linebreak'
        },
        alternateRowStyles: {
          fillColor: [250, 250, 249] // stone-50
        },
        margin: { top: 35, left: 14, right: 14 }
      });

      // Footer con info
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(168, 162, 158); // stone-400
      doc.text(`Calzados La Peruanita • Página ${pageCount} • ${data.length} registros`, 14, doc.internal.pageSize.height - 10);

      const fileName = `${options.filename || 'reporte'}.pdf`;
      doc.save(fileName);
      
      console.log('✅ PDF exportado exitosamente:', fileName);
    } catch (error) {
      console.error('Error exportando PDF:', error);
      alert('Error al generar PDF. Por favor intenta con CSV o Excel.');
    }
  }

  /**
   * Genera factura/ticket en PDF
   */
  generateInvoice(sale: any): void {
    console.log('🧾 Generando factura:', sale);
    
    // TODO: Implementar generación de factura con jsPDF
    alert('Factura: Funcionalidad en desarrollo');
  }

  /**
   * Genera ticket de venta para impresión térmica (80mm)
   */
  printTicket(sale: any): void {
  try {
    const printWindow = window.open('', '_blank', 'width=1000,height=800,left=200,top=100');

    if (!printWindow) {
      alert('Por favor permite ventanas emergentes para imprimir');
      return;
    }

    const ticketHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Boleta Electrónica #${sale.saleNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            background: #f4f4f4;
          }
          .invoice-container {
            background: #fff;
            padding: 40px;
            max-width: 900px;
            margin: 20px auto;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
          }
          .header { display: flex; justify-content: space-between; margin-bottom: 25px; }
          .company-info h1 { font-size: 24px; color: #111; margin-bottom: 4px; letter-spacing: 1px; text-transform: uppercase; font-weight: 900;}
          .company-info p { font-size: 13px; color: #555; margin-bottom: 3px; }
          .invoice-box { border: 2px solid #111; text-align: center; padding: 15px; border-radius: 8px; min-width: 250px; background: #fafafa; }
          .invoice-box h2 { font-size: 15px; margin: 8px 0; letter-spacing: 1px; }
          .invoice-box p { font-size: 20px; font-weight: bold; margin: 0; color: #d32f2f; }
          .invoice-box p.ruc { font-size: 16px; color: #111; margin-bottom: 3px; }
          
          .customer-info { border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 25px; display: flex; flex-wrap: wrap; gap: 15px; background: #fdfdfd; }
          .customer-item { flex: 1 1 45%; }
          .customer-item span.label { font-weight: 800; font-size: 11px; color: #555; display: block; text-transform: uppercase; margin-bottom: 3px; }
          .customer-item span.value { font-size: 14px; color: #111; font-weight: 500; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; border: 1px solid #ddd; }
          th { background: #111; text-align: left; padding: 10px; font-size: 12px; color: #fff; text-transform: uppercase; border-bottom: 2px solid #111; }
          td { padding: 10px; font-size: 14px; border-bottom: 1px solid #eee; vertical-align: top; color: #222; }
          .right { text-align: right; }
          
          .totals-wrapper { display: flex; justify-content: flex-end; }
          .totals-box { width: 320px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; background: #fafafa; }
          .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #eee; color: #444; }
          .totals-row.grand-total { font-size: 18px; font-weight: 900; border-bottom: none; border-top: 2px solid #111; padding-top: 12px; margin-top: 4px; color: #111; }
          
          .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px; }
          .qr-placeholder { width: 90px; height: 90px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; padding: 5px; background: #fff;}
          .qr-placeholder img { width: 100%; height: 100%; object-fit: contain; }

          @media print {
            @page { size: A4; margin: 0; } 
            body { background: #fff; }
            .invoice-container { 
              margin: 0; 
              padding: 10mm; /* REBAJADO A 1CM PARA APROVECHAR LA HOJA AL MÁXIMO */
              box-shadow: none; 
              max-width: 100%; 
              border: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
          <div class="company-info">
            <h1>${sale.businessName || 'CALZADOS LA PERUANITA'}</h1>
            <p><strong>Razón Social:</strong> Inversiones Zen S.A.C.</p>
            <p><strong>Dirección:</strong> ${sale.address || 'Jr. La Moda 123, Huancayo - Perú'}</p>
            <p><strong>Teléfono:</strong> (064) 123-456</p>
          </div>
          <div class="invoice-box">
            <p class="ruc">R.U.C. ${sale.ruc || '20123456789'}</p>
            <h2>BOLETA DE VENTA ELECTRÓNICA</h2>
            <p>${sale.saleNumber}</p>
          </div>
        </div>

        <div class="customer-info">
          <div class="customer-item">
            <span class="label">Señor(es) / Cliente</span>
            <span class="value">${sale.customer?.name && sale.customer.name !== 'Cliente' ? sale.customer.name : 'Público General'}</span>
          </div>
          <div class="customer-item">
            <span class="label">DNI / Celular</span>
            <span class="value">${sale.customer?.phone || '---'}</span>
          </div>
          <div class="customer-item">
            <span class="label">Fecha de Emisión</span>
            <span class="value">${new Date(sale.date || new Date()).toLocaleDateString('es-PE')} ${new Date(sale.date || new Date()).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="customer-item">
            <span class="label">Condición de Pago</span>
            <span class="value">${sale.paymentMethod ? sale.paymentMethod.toUpperCase() : 'CONTADO'}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 10%">Cant.</th>
              <th style="width: 50%">Descripción del Producto</th>
              <th style="width: 20%" class="right">Precio Unit.</th>
              <th style="width: 20%" class="right">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map((item: any) => `
              <tr>
                <td>${item.quantity}</td>
                <td>
                  <strong>${item.productName || item.productId}</strong>
                  ${item.size || item.color ? `
                    <div style="font-size: 12px; color: #666; margin-top: 4px;">
                      ${item.size ? `Talla: ${item.size}` : ''}
                      ${item.size && item.color ? ' | ' : ''}
                      ${item.color ? `Color: ${item.color}` : ''}
                    </div>
                  ` : ''}
                </td>
                <td class="right">S/ ${item.unitPrice.toFixed(2)}</td>
                <td class="right">S/ ${(item.unitPrice * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-wrapper">
          <div class="totals-box">
            <div class="totals-row">
              <span>Op. Gravadas</span>
              <span>S/ ${sale.subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>IGV (18%)</span>
              <span>S/ ${(sale.total - sale.subtotal).toFixed(2)}</span>
            </div>
            ${sale.discount > 0 ? `
              <div class="totals-row" style="color: red;">
                <span>Descuento</span>
                <span>- S/ ${sale.discount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="totals-row grand-total">
              <span>Total a Pagar</span>
              <span>S/ ${sale.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <div class="qr-placeholder">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(sale.ruc || '20123456789')}|03|${sale.saleNumber}|${sale.total}" alt="QR Code">
          </div>
          <p>Representación impresa de la Boleta de Venta Electrónica</p>
          <p>Consulte su comprobante en <strong>www.laperuanita.pe/comprobantes</strong></p>
          <p style="margin-top: 10px; font-weight: bold; color: #000; font-size: 14px;">¡Gracias por su compra!</p>
        </div>
        </div>

      </body>
      </html>
    `;

    printWindow.document.write(ticketHTML);
    printWindow.document.close();

    printWindow.focus();
    
    // Le decimos a la ventana que se cierre SOLA después de que el usuario termine en el diálogo
    printWindow.onafterprint = () => {
      printWindow.close();
    };

    // Damos 500ms de gracia para que la imagen del código QR termine de cargar desde la API
    setTimeout(() => {
      printWindow.print();
    }, 500);

  } catch (error) {
    console.error('Error imprimiendo ticket:', error);
    alert('Error al generar el ticket de impresión');
  }
}

  /**
   * Exporta datos del dashboard (KPIs + charts)
   */
  exportDashboard(dashboardData: any, format: 'excel' | 'pdf' = 'excel'): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `dashboard-${timestamp}`;

    if (format === 'excel') {
      // Preparar múltiples hojas
      const kpisData = [
        { Métrica: 'Margen de Ganancia', Valor: `${dashboardData.profitMargin}%` },
        { Métrica: 'ROI Mensual', Valor: `${dashboardData.roi}%` },
        { Métrica: 'Ticket Promedio', Valor: `S/ ${dashboardData.avgTicket}` },
        { Métrica: 'Tasa de Conversión', Valor: `${dashboardData.conversionRate}%` }
      ];

      this.exportToExcel(kpisData, filename, 'KPIs');
    } else {
      this.exportToPDF([], [], { filename, title: 'Dashboard - Calzados La Peruanita' });
    }
  }
}
