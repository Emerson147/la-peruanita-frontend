import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EscPosPrinterService {
  private device: any = null;
  private outEndpointNumber: number = -1;

  constructor() {}

  /**
   * Conecta a la impresora pidiendo permisos al usuario a través del navegador.
   * Requiere HTTPS o localhost.
   */
  async connect(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.usb) {
        alert('WebUSB no está soportado en este navegador. Por favor usa Google Chrome o Microsoft Edge.');
        return false;
      }

      // classCode 0x07 significa "USB Printer" en el estándar USB
      this.device = await nav.usb.requestDevice({ filters: [{ classCode: 0x07 }] });
      
      await this.device.open();

      if (this.device.configuration === null) {
        await this.device.selectConfiguration(1);
      }

      // Buscar dinámicamente la interfaz que tiene un endpoint OUT
      let targetInterface = -1;
      this.outEndpointNumber = -1;

      for (const iface of this.device.configuration.interfaces) {
        // En WebUSB, los endpoints están dentro de 'alternate' o 'alternates[0]'
        const endpoints = iface.alternate ? iface.alternate.endpoints : iface.alternates[0].endpoints;
        for (const ep of endpoints) {
          if (ep.direction === 'out') {
            targetInterface = iface.interfaceNumber;
            this.outEndpointNumber = ep.endpointNumber;
            break;
          }
        }
        if (targetInterface !== -1) break;
      }

      if (targetInterface === -1) {
        console.error('No se encontró ninguna interfaz con un puerto OUT en la impresora USB.');
        return false;
      }

      // Reclamamos EXACATAMENTE la interfaz que nos sirve
      await this.device.claimInterface(targetInterface);
      
      console.log(`Impresora USB conectada con éxito. Interfaz: ${targetInterface}, Endpoint OUT: ${this.outEndpointNumber}`, this.device);
      return true;
    } catch (error) {
      console.error('Error conectando a la impresora WebUSB:', error);
      return false;
    }
  }

  /**
   * Envía el texto crudo a la impresora, utilizando el Endpoint OUT descubierto en connect().
   */
  async printRaw(text: string): Promise<void> {
    if (!this.device || this.outEndpointNumber === -1) {
      const connected = await this.connect();
      if (!connected) return;
    }

    try {
      // TextEncoder convierte el String en un Uint8Array de bytes
      const encoder = new TextEncoder();
      const data = encoder.encode(text);

      await this.device.transferOut(this.outEndpointNumber, data);
    } catch (error) {
      console.error('Error transmitiendo datos a la impresora:', error);
      
      // Si el error fue desconexión, limpiamos el estado
      if (String(error).includes('disconnected') || String(error).includes('claim')) {
         this.device = null;
         this.outEndpointNumber = -1;
      }
    }
  }

  /**
   * Limpia tildes y caracteres especiales para evitar símbolos chinos en la impresora térmica
   */
  private normalizeText(str: string): string {
    if (!str) return '';
    return str.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quita tildes
      .replace(/ñ/g, 'n').replace(/Ñ/g, 'N') // Reemplaza Ñ
      .toUpperCase(); // Todo en mayúsculas para un look más clásico de POS
  }

  /**
   * Toma los datos de una venta y construye el ticket en puro texto ASCII
   * con los comandos ESC/POS avanzados para la Xprinter POS-80
   */
  async printSaleTicket(sale: any): Promise<void> {
    // Comandos Mágicos ESC/POS
    const INIT = '\x1B\x40';         // Reset / Inicializar
    const CENTER = '\x1B\x61\x01';   // Alinear al centro
    const LEFT = '\x1B\x61\x00';     // Alinear a la izquierda
    const BOLD_ON = '\x1B\x45\x01';  // Activar Negrita
    const BOLD_OFF = '\x1B\x45\x00'; // Desactivar Negrita
    const DOUBLE_SIZE = '\x1D\x21\x11'; // Doble Ancho + Doble Alto
    const NORMAL_SIZE = '\x1D\x21\x00'; // Tamaño normal
    const CUT = '\x1D\x56\x00';      // Cortar papel
    
    // Separadores a 42 caracteres (ancho seguro para impresoras 80mm)
    const LINE_SINGLE = "------------------------------------------\n";
    
    let ticket = INIT;
    
    // ESTILO NIUBIZ / IZIPAY
    // ----------------------
    // ENCABEZADO
    ticket += CENTER + DOUBLE_SIZE + BOLD_ON + "LA PERUANITA\n" + NORMAL_SIZE + BOLD_OFF;
    ticket += CENTER + "INVERSIONES ZEN S.A.C.\n";
    ticket += "RUC: 20123456789\n";
    ticket += "Jr. La Moda 123, Huancayo\n";
    ticket += "\n";
    
    ticket += BOLD_ON + "BOLETA DE VENTA ELECTRONICA\n" + BOLD_OFF;
    ticket += "\n";

    // DATOS DE TRANSACCION (Alineado a la Izquierda)
    ticket += LEFT;
    ticket += `FECHA: ${new Date().toLocaleDateString('es-PE')}     HORA: ${new Date().toLocaleTimeString('es-PE', {hour: '2-digit', minute:'2-digit'})}\n`;
    ticket += LINE_SINGLE;
    ticket += BOLD_ON + `NRO. TICKET : ${sale.saleNumber || '000000'}\n` + BOLD_OFF;
    
    if (sale.customer?.name) {
      ticket += `CLIENTE     : ${this.normalizeText(sale.customer.name).substring(0, 26)}\n`;
    }
    if (sale.customer?.phone) {
      ticket += `DNI/CEL     : ${sale.customer.phone}\n`;
    }
    ticket += LINE_SINGLE;
    
    // CABECERA DE ÍTEMS
    ticket += "CANT DESCRIPCION               IMPORTE\n";
    ticket += LINE_SINGLE;

    // ÍTEMS DE LA VENTA
    // Grilla Niubiz: [Cant:4] [Desc:22] [Importe:14] = 40 chars
    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        const qty = item.quantity.toString().padEnd(4, ' ');
        const nameRaw = this.normalizeText(item.product?.name || item.productId || 'ITEM');
        const name = nameRaw.substring(0, 22).padEnd(22, ' ');
        const total = "S/ " + (item.unitPrice * item.quantity).toFixed(2).padStart(8, ' ');
        
        ticket += `${qty} ${name} ${total.padStart(13, ' ')}\n`;
        
        // Agregar talla y color en una segunda línea si existen
        if (item.size || item.color) {
          const variants = `      T:${item.size || '-'} C:${item.color || '-'}`.substring(0, 42);
          ticket += `${this.normalizeText(variants)}\n`;
        }
      }
    }

    ticket += LINE_SINGLE;
    
    // TOTALES
    const subtotal = sale.subtotal ? sale.subtotal.toFixed(2) : '0.00';
    const igv = sale.total ? (sale.total - (sale.subtotal || sale.total)).toFixed(2) : '0.00';
    const strTotal = sale.total ? sale.total.toFixed(2) : '0.00';
    
    ticket += `OP. GRAVADA              S/ ${subtotal.padStart(10, ' ')}\n`;
    ticket += `IGV (18%)                S/ ${igv.padStart(10, ' ')}\n`;
    
    if (sale.discount > 0) {
       const strDiscount = sale.discount.toFixed(2);
       ticket += `DESCUENTO              - S/ ${strDiscount.padStart(10, ' ')}\n`;
    }
    
    ticket += LINE_SINGLE;
    ticket += DOUBLE_SIZE + BOLD_ON + `TOTAL A PAGAR  S/ ${strTotal.padStart(8, ' ')}\n` + NORMAL_SIZE + BOLD_OFF;
    ticket += LINE_SINGLE;
    
    if (sale.paymentMethod) {
      const pMethod = this.normalizeText(sale.paymentMethod);
      ticket += CENTER + BOLD_ON + `*** PAGO CON ${pMethod} ***\n` + BOLD_OFF;
      ticket += LINE_SINGLE;
    }
    
    // PIE DEL TICKET
    ticket += "\n";
    ticket += CENTER + BOLD_ON + "¡GRACIAS POR SU COMPRA!\n" + BOLD_OFF;
    ticket += "Conserve este ticket como\n";
    ticket += "comprobante de pago.\n";
    ticket += "\nwww.laperuanita.pe\n";
    
    // ESPACIO PARA QUE SALGA EL PAPEL Y LUEGO CORTE
    ticket += "\n\n\n\n"; 
    ticket += CUT;

    // Mandar todo junto por USB
    await this.printRaw(ticket);
  }
}
