import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Almacen } from '../../../core/models';
import { AlmacenService } from '../../../core/services/almacen.service';
import { ToastService } from '../../../core/services/toast.service';
import { UiAnimatedDialogComponent, UiInputComponent, UiButtonComponent, UiLabelComponent, UiBadgeComponent, UiPageHeaderComponent } from '../../../shared/ui';

@Component({
  selector: 'app-almacenes-page',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    UiAnimatedDialogComponent,
    UiInputComponent,
    UiButtonComponent,
    UiLabelComponent,
    UiBadgeComponent,
    UiPageHeaderComponent
  ],
  templateUrl: './almacenes-page.component.html',
  styleUrl: './almacenes-page.component.css'
})
export class AlmacenesPageComponent implements OnInit {
  private almacenService = inject(AlmacenService);
  private toast = inject(ToastService);

  almacenes = signal<Almacen[]>([]);
  isLoading = signal(true);

  // KPIs
  totalAlmacenes = computed(() => this.almacenes().length);
  activosCount = computed(() => this.almacenes().filter(a => a.activo).length);
  inactivosCount = computed(() => this.almacenes().filter(a => !a.activo).length);

  // Modal State
  isModalOpen = signal(false);
  editingAlmacen = signal<Almacen | null>(null);
  confirmDeleteId = signal<string | null>(null);

  // Form State
  formData = signal({
    nombre: '',
    direccion: '',
    activo: true
  });
  
  formError = signal('');
  isSaving = signal(false);

  ngOnInit() {
    this.loadAlmacenes();
  }

  loadAlmacenes() {
    this.isLoading.set(true);
    this.almacenService.getAlmacenes().subscribe({
      next: (data) => {
        this.almacenes.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error("Error cargando almacenes", err);
        this.toast.error("No se pudieron cargar los almacenes.");
        this.isLoading.set(false);
      }
    });
  }

  openCreateModal() {
    this.editingAlmacen.set(null);
    this.formData.set({
      nombre: '',
      direccion: '',
      activo: true
    });
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  openEditModal(almacen: Almacen) {
    this.editingAlmacen.set(almacen);
    this.formData.set({
      nombre: almacen.nombre,
      direccion: almacen.direccion || '',
      activo: almacen.activo
    });
    this.formError.set('');
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    this.editingAlmacen.set(null);
    this.formError.set('');
  }

  toggleActivo(almacen: Almacen) {
    const updated = { ...almacen, activo: !almacen.activo };
    this.almacenService.actualizarAlmacen(almacen.id!, updated).subscribe({
      next: () => {
        this.toast.success(`Almacén ${updated.activo ? 'activado' : 'inactivado'} correctamente`);
        this.loadAlmacenes();
      },
      error: () => this.toast.error("No se pudo cambiar el estado del almacén")
    });
  }

  saveAlmacen() {
    const data = this.formData();
    if (!data.nombre.trim()) {
      this.formError.set('El nombre del almacén es requerido');
      return;
    }

    this.isSaving.set(true);
    const editing = this.editingAlmacen();

    if (editing) {
      this.almacenService.actualizarAlmacen(editing.id!, data).subscribe({
        next: () => {
          this.toast.success("Almacén actualizado correctamente");
          this.loadAlmacenes();
          this.closeModal();
          this.isSaving.set(false);
        },
        error: (err) => {
          this.formError.set(err.error?.message || "Error al actualizar almacén");
          this.isSaving.set(false);
        }
      });
    } else {
      this.almacenService.crearAlmacen(data).subscribe({
        next: () => {
          this.toast.success("Almacén registrado con éxito");
          this.loadAlmacenes();
          this.closeModal();
          this.isSaving.set(false);
        },
        error: (err) => {
          this.formError.set(err.error?.message || "Error al registrar almacén");
          this.isSaving.set(false);
        }
      });
    }
  }

  confirmDelete(id: string) {
    this.confirmDeleteId.set(id);
  }

  cancelDelete() {
    this.confirmDeleteId.set(null);
  }

  executeDelete() {
    const id = this.confirmDeleteId();
    if (!id) return;
    
    this.almacenService.eliminarAlmacen(id).subscribe({
      next: () => {
        this.toast.info("Almacén eliminado correctamente.");
        this.loadAlmacenes();
        this.confirmDeleteId.set(null);
      },
      error: (err) => {
        this.toast.error("Hubo un error al eliminar el almacén.");
        this.confirmDeleteId.set(null);
      }
    });
  }
}
