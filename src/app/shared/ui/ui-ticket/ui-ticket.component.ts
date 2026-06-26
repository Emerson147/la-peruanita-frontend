import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import QRCode from 'qrcode';
import { SettingsService } from '../../../core/services/settings.service';
import { ExportService } from '../../../core/services/export.service';
import { EscPosPrinterService } from '../../../core/services/escpos-printer.service';
import { inject } from '@angular/core';

export interface CartItem {
  product: {
    id: string;
    name: string;
    price: number;
    category?: string;
  };
  quantity: number;
  variant?: {
    id: string;
    size: string;
    color: string;
  };
}

@Component({
  selector: 'app-ui-ticket',
  standalone: true,
  imports: [CommonModule],
  template: `
    <dialog
      #ticketDialog
      class="bg-transparent p-0 m-auto backdrop:bg-stone-900/40 dark:backdrop:bg-black/60 backdrop:backdrop-blur-md open:animate-in open:fade-in overflow-hidden no-scrollbar"
      (click)="close()"
      (cancel)="$event.preventDefault(); cancel()"
    >
      @if (isOpen) {
        <!-- Toast de éxito -->
        @if (showSuccess) {
          <div
            class="fixed top-6 right-6 bg-emerald-500/90 backdrop-blur-sm text-white px-5 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top-2 text-sm font-bold flex items-center gap-2 z-[70] border border-emerald-400"
          >
            <span class="material-symbols-outlined text-lg">check_circle</span>
            {{ successMessage }}
          </div>
        }

        <!-- Ticket Container (Premium Receipt Style) -->
        <div
          class="relative w-[400px] max-w-[90vw] mx-auto bg-white dark:bg-[#18181b] shadow-[0_40px_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 fade-in duration-300 font-sans flex flex-col rounded-t-3xl"
          style="
            clip-path: polygon(
              0 0, 100% 0,
              100% calc(100% - 12px), 95% 100%, 90% calc(100% - 12px), 85% 100%, 80% calc(100% - 12px), 75% 100%, 70% calc(100% - 12px), 65% 100%, 60% calc(100% - 12px), 55% 100%, 50% calc(100% - 12px), 45% 100%, 40% calc(100% - 12px), 35% 100%, 30% calc(100% - 12px), 25% 100%, 20% calc(100% - 12px), 15% 100%, 10% calc(100% - 12px), 5% 100%, 0 calc(100% - 12px)
            );
          "
          (click)="$event.stopPropagation()"
        >
          <!-- Efecto de textura sutil -->
          <div class="absolute inset-0 opacity-[0.02] dark:opacity-[0.03] pointer-events-none" style="background-image: url('data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23noise)\'/%3E%3C/svg%3E');"></div>

          <!-- Header -->
          <div class="pt-10 px-8 pb-6 flex flex-col items-center text-center relative shrink-0">
            <!-- Botón cerrar -->
            <button
              (click)="cancel()"
              class="absolute top-5 right-5 h-8 w-8 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center justify-center transition-all text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 no-print"
              aria-label="Cerrar recibo"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>

            <!-- Icono de Éxito -->
            <div
              class="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-4 shadow-[0_0_40px_rgba(16,185,129,0.2)] animate-in zoom-in duration-700"
            >
              <span class="material-symbols-outlined text-3xl font-bold">check</span>
            </div>

            <h2 class="text-xl font-bold text-stone-900 dark:text-white uppercase tracking-tight">
              {{ settingsService.config()?.businessName || 'La Peruanita' }}
            </h2>
            <p class="text-xs text-stone-500 dark:text-stone-400 mt-1 font-medium">
              RUC: {{ settingsService.config()?.ruc || '20123456789' }}
            </p>
            <time class="mt-4 px-3 py-1 bg-stone-50 dark:bg-stone-800/50 rounded-lg text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-widest font-bold">
              {{ date | date: 'dd/MM/yyyy · HH:mm' }}
            </time>
          </div>

          <!-- Divisor Minimalista -->
          <div class="mx-8 border-t-2 border-dashed border-stone-200 dark:border-stone-700/60 shrink-0"></div>

          <!-- Cuerpo: Datos principales -->
          <dl class="px-8 py-5 grid grid-cols-2 gap-4 text-[11px] shrink-0">
            <div>
              <dt class="text-stone-400 uppercase tracking-[0.2em] mb-1 font-bold text-[9px]">Cliente</dt>
              <dd class="font-black text-stone-900 dark:text-stone-100 text-sm uppercase truncate">
                {{ clientName || 'General' }}
              </dd>
            </div>
            <div class="text-right">
              <dt class="text-stone-400 uppercase tracking-[0.2em] mb-1 font-bold text-[9px]">Pago</dt>
              <dd class="flex items-center justify-end gap-1.5 font-black text-stone-900 dark:text-stone-100 text-sm uppercase">
                <span class="material-symbols-outlined text-[14px] text-emerald-500">
                  {{ paymentMethod === 'Efectivo' ? 'payments' : paymentMethod === 'Tarjeta' ? 'credit_card' : 'qr_code_scanner' }}
                </span>
                {{ paymentMethod || 'Efectivo' }}
              </dd>
            </div>
          </dl>

          <!-- Lista de productos (Scrollable) -->
          <div class="px-8 pb-2 space-y-4 flex-1 overflow-y-auto no-scrollbar min-h-0">
            <div class="flex justify-between text-[9px] text-stone-400 uppercase tracking-[0.2em] font-black pb-2 border-b border-stone-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-[#18181b] z-10">
              <span>Concepto</span>
              <span>Subtotal</span>
            </div>

            @for (item of items; track $index) {
              <div class="flex justify-between items-start group/item">
                <div class="flex flex-col gap-0.5">
                  <div class="flex items-start gap-2">
                    <span class="bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 px-1.5 py-0.5 rounded text-[10px] font-black tabular-nums mt-0.5">{{ item.quantity }}x</span>
                    <span class="text-sm font-bold text-stone-800 dark:text-stone-200 uppercase tracking-tight leading-tight pt-0.5">{{ item.product.name }}</span>
                  </div>
                  <div class="text-[10px] text-stone-400 ml-8 flex flex-wrap gap-x-2 font-medium">
                    <span>S/ {{ item.product.price | number: '1.2-2' }} c/u</span>
                    @if (item.variant?.size) { <span class="uppercase">Talle: {{ item.variant?.size }}</span> }
                    @if (item.variant?.color) { <span class="uppercase">Color: {{ item.variant?.color }}</span> }
                  </div>
                </div>
                <span class="font-mono text-sm font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                  S/ {{ item.product.price * item.quantity | number: '1.2-2' }}
                </span>
              </div>
            }
          </div>

          <!-- Footer con totales -->
          <div class="px-8 pt-4 pb-12 bg-stone-50/50 dark:bg-stone-900/20 relative shrink-0">
            <div class="absolute top-0 left-8 right-8 border-t-2 border-dashed border-stone-200 dark:border-stone-800"></div>

            <dl class="space-y-1.5 mb-4 text-[11px] pt-4">
              <div class="flex justify-between font-bold text-stone-400 uppercase tracking-wide">
                <dt>Subtotal neto</dt>
                <dd class="text-stone-600 dark:text-stone-300 tabular-nums">S/ {{ subtotal | number: '1.2-2' }}</dd>
              </div>
              <div class="flex justify-between font-bold text-stone-400 uppercase tracking-wide">
                <dt>IGV ({{ settingsService.config()?.taxPercent || 18 }}%)</dt>
                <dd class="text-stone-600 dark:text-stone-300 tabular-nums">S/ {{ tax | number: '1.2-2' }}</dd>
              </div>
              @if (change > 0) {
                <div class="flex justify-between font-bold text-emerald-500 uppercase tracking-wide pt-1">
                  <dt>Vuelto Entregado</dt>
                  <dd class="tabular-nums">S/ {{ change | number: '1.2-2' }}</dd>
                </div>
              }
            </dl>

            <div class="flex justify-between items-center border-t border-stone-200 dark:border-stone-700 pt-4 mb-6">
              <span class="text-sm font-black text-stone-900 dark:text-white uppercase tracking-[0.2em]">Total</span>
              <dd class="text-2xl font-black text-stone-900 dark:text-white tracking-tight tabular-nums">
                S/ {{ total | number: '1.2-2' }}
              </dd>
            </div>

            <!-- Acciones finales -->
            <div class="flex flex-col gap-2.5 w-full no-print relative z-20">
              <button
                (click)="close()"
                class="w-full py-4 rounded-[1rem] font-bold text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-stone-900/10 dark:shadow-black/40 bg-stone-900 text-white dark:bg-white dark:text-stone-900 hover:opacity-90"
              >
                Nueva Venta
                <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>

              <div class="flex gap-2">
                <button
                  (click)="printTicket()"
                  class="flex-1 flex items-center justify-center gap-1.5 px-3 py-3.5 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white rounded-[1rem] text-[10px] font-bold uppercase tracking-widest hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500"
                >
                  <span class="material-symbols-outlined text-[16px]">print</span>
                  Imprimir
                </button>
                <button
                  (click)="sendToWhatsApp()"
                  [disabled]="!clientPhone"
                  class="flex-1 flex items-center justify-center gap-1.5 px-3 py-3.5 bg-[#25D366]/10 text-[#1da851] rounded-[1rem] text-[10px] font-bold uppercase tracking-widest hover:bg-[#25D366]/20 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 disabled:opacity-30"
                >
                  <span class="material-symbols-outlined text-[16px]">chat</span>
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: [
    `
      /* Animación de slide-in para toast */
      @keyframes slideInFromTop {
        0% {
          opacity: 0;
          transform: translateY(-20px);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .animate-in {
        animation: slideInFromTop 0.3s ease-out;
      }

      /* Los estilos de impresión para ticketeras térmicas (80mm) se han unificado y optimizado globalmente en src/styles.css para evitar problemas de encapsulación de Angular */
    `,
  ],
})
export class UiTicketComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() items: CartItem[] = [];
  @Input() total = 0;
  @Input() clientName = 'Cliente';
  @Input() clientPhone = '';
  @Input() ticketNumber = 1;
  @Input() paymentMethod = '';
  @Input() amountPaid = 0;

  @Output() closeTicket = new EventEmitter<void>(); // Se usa para confirmar
  @Output() cancelTicket = new EventEmitter<void>(); // Se usa para abortar la venta (la X)
  @Output() ticketPrinted = new EventEmitter<void>();
  @Output() ticketSent = new EventEmitter<void>();

  @ViewChild('ticketDialog') ticketDialog!: ElementRef<HTMLDialogElement>;

  settingsService = inject(SettingsService);
  exportService = inject(ExportService);
  escPosPrinter = inject(EscPosPrinterService);

  date = new Date();
  showSuccess = false;
  successMessage = '';
  qrCode = '';

  // Calculados
  get taxRate(): number {
    return (this.settingsService.config()?.taxPercent || 18) / 100;
  }

  get subtotal(): number {
    return this.total / (1 + this.taxRate);
  }

  get tax(): number {
    return this.total - this.subtotal;
  }

  get change(): number {
    return this.amountPaid - this.total;
  }

  ngOnInit() {
    // Inicialización
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.generateQRCode();
        setTimeout(() => {
          if (this.ticketDialog?.nativeElement) {
            this.ticketDialog.nativeElement.showModal();
          }
        }, 0);
      } else {
        if (this.ticketDialog?.nativeElement) {
          this.ticketDialog.nativeElement.close();
        }
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.isOpen) {
      this.cancel();
    }
  }

  close() {
    // CONFIRMAR VENTA
    if (this.ticketDialog?.nativeElement) {
      this.ticketDialog.nativeElement.close();
    }
    this.isOpen = false;
    this.closeTicket.emit();
  }

  cancel() {
    // ABORTAR VENTA (BOTÓN X)
    if (this.ticketDialog?.nativeElement) {
      this.ticketDialog.nativeElement.close();
    }
    this.isOpen = false;
    this.cancelTicket.emit();
  }

  printTicket() {
    // Reconstruir el objeto de venta para enviarlo a WebUSB
    const saleForPrint = {
      saleNumber: 'VENTA-' + this.ticketNumber.toString().padStart(4, '0'),
      date: this.date,
      customer: { name: this.clientName, phone: this.clientPhone },
      items: this.items.map(i => ({
        quantity: i.quantity,
        product: { name: i.product.name },
        unitPrice: i.product.price,
        size: i.variant?.size,
        color: i.variant?.color,
        subtotal: i.product.price * i.quantity
      })),
      subtotal: this.subtotal,
      discount: 0,
      total: this.total,
      paymentMethod: this.paymentMethod
    };

    // Imprimir el ticket crudo usando el nuevo servicio WebUSB
    this.escPosPrinter.printSaleTicket(saleForPrint)
      .then(() => {
        this.ticketPrinted.emit();
        this.showSuccessToast('Ticket enviado por USB');
      })
      .catch(error => {
        console.error('Error al imprimir por USB', error);
        this.showSuccessToast('Error al imprimir', false);
      });
  }

  sendToWhatsApp() {
    if (!this.clientPhone) {
      this.showSuccessToast('Por favor ingrese el número del cliente', false);
      return;
    }

    const businessName = this.settingsService.config()?.businessName || 'DENFAR';
    const address = this.settingsService.config()?.address || 'Jr. La Moda 123, Huancayo';
    const taxPercent = this.settingsService.config()?.taxPercent || 18;

    // Construir mensaje formateado
    let message = `¡Hola *${this.clientName}*! 🧥✨\n\n`;
    message += `Gracias por tu compra en *${businessName}*\n\n`;
    message += `📋 *Ticket #${this.ticketNumber.toString().padStart(6, '0')}*\n`;
    message += `📅 ${this.date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}\n\n`;

    message += `*Detalle de tu pedido:*\n`;
    message += `━━━━━━━━━━━━━━━\n`;

    this.items.forEach((item) => {
      const itemTotal = (item.product.price * item.quantity).toFixed(2);
      message += `• ${item.quantity}x ${item.product.name}\n`;
      message += `  S/ ${item.product.price.toFixed(2)} c/u = S/ ${itemTotal}\n`;
    });

    message += `━━━━━━━━━━━━━━━\n\n`;
    message += `Subtotal: S/ ${this.subtotal.toFixed(2)}\n`;
    message += `IGV (${taxPercent}%): S/ ${this.tax.toFixed(2)}\n`;
    message += `💰 *TOTAL: S/ ${this.total.toFixed(2)}*\n\n`;

    if (this.paymentMethod && this.amountPaid > 0) {
      message += `Método de pago: ${this.paymentMethod}\n`;
      message += `Recibido: S/ ${this.amountPaid.toFixed(2)}\n`;
      if (this.change > 0) {
        message += `Cambio: S/ ${this.change.toFixed(2)}\n\n`;
      }
    }

    message += `¡Esperamos verte pronto! 🙏\n`;
    message += `_${address}_`;

    // Limpiar el número de teléfono (solo dígitos)
    const cleanPhone = this.clientPhone.replace(/\D/g, '');

    // Construir URL de WhatsApp
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    // Abrir en nueva pestaña
    window.open(url, '_blank');

    // Emitir evento y mostrar confirmación
    this.ticketSent.emit();
    this.showSuccessToast('Mensaje enviado a WhatsApp');
  }

  private showSuccessToast(message: string, isSuccess = true) {
    this.successMessage = message;
    this.showSuccess = true;

    setTimeout(() => {
      this.showSuccess = false;
    }, 2500);
  }

  // Método para generar código QR
  async generateQRCode() {
    try {
      // QR simple y corto para fácil escaneo
      const ticketId = this.ticketNumber.toString().padStart(6, '0');
      const businessName = this.settingsService.config()?.businessName || 'DENFAR';

      // Contenido mínimo = QR más simple y escaneable
      const qrContent = `${businessName} #${ticketId}\nTotal: S/${this.total.toFixed(2)}\n${this.items.length} items`;

      this.qrCode = await QRCode.toDataURL(qrContent, {
        width: 150,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (error) {
      console.error('Error generando QR:', error);
    }
  }
}
