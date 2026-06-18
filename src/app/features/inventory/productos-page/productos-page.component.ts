import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  effect,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ProductService } from '../../../core/services/product.service';
import { AlmacenService } from '../../../core/services/almacen.service';
import { CloudinaryService } from '../../../core/services/cloudinary.service';
import { ProductVariant, Almacen } from '../../../core/models';
import {
  UiInputComponent,
  UiButtonComponent,
  UiAnimatedDialogComponent,
  UiLabelComponent,
  UiPageHeaderComponent,
} from '../../../shared/ui';
import { ToastService } from '../../../core/services/toast.service';
import { ImageFallbackDirective } from '../../../shared/directives/image-fallback.directive';

@Component({
  selector: 'app-productos-page',
  standalone: true,
  imports: [
    CommonModule,
    ScrollingModule, //  Virtual Scrolling
    UiInputComponent,
    UiButtonComponent,
    UiAnimatedDialogComponent,
    UiLabelComponent,
    UiPageHeaderComponent,
    ImageFallbackDirective,
  ],
  templateUrl: './productos-page.component.html',
  styleUrls: ['./productos-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush, //  Optimización de Change Detection
})
export class ProductosPageComponent {
  private productService = inject(ProductService);
  private almacenService = inject(AlmacenService);
  private cloudinary = inject(CloudinaryService);
  private toastService = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  // Debounce para búsqueda (Fase 2)
  private searchSubject = new Subject<string>();
  private debouncedSearch = signal('');

  // 🆕 Sistema de Confirmación Custom
  isConfirmDialogOpen = signal(false);
  confirmData = signal<{
    title: string;
    message: string;
    actionLabel: string;
    isDestructive: boolean;
    onConfirm: () => void;
  } | null>(null);

  constructor() {
    // Configurar debounce de 300ms para la búsqueda
    const subscription = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        this.debouncedSearch.set(value);
      });

    //  Cleanup automático
    this.destroyRef.onDestroy(() => subscription.unsubscribe());

    // Cargar almacenes
    this.almacenService.getAlmacenes().subscribe({
      next: (data) => this.almacenes.set(data),
      error: (err) => console.error('Error cargando almacenes', err),
    });
  }

  //  Estado de upload de imagen
  isUploadingImage = signal(false);
  uploadProgress = signal(0);
  selectedFile = signal<File | null>(null);
  isDragging = signal(false); // Estado para drag & drop

  //  Estados para UI Avanzada
  viewMode = signal<'list' | 'grid'>('list');
  selectedProducts = signal<string[]>([]);
  showStats = signal<boolean>(true);
  activeDropdownId = signal<string | null>(null);

  // Productos desde el servicio central
  products = this.productService.products;
  almacenes = signal<Almacen[]>([]);

  // Señales para búsqueda y modal
  searchQuery = signal('');

  //  Sistema de filtros inicial
  selectedCategory = signal<string | null>(null);
  selectedGender = signal<string | null>(null);

  // Categorías disponibles
  categories = computed(() => {
    const cats = new Set(this.products().map((p) => p.category));
    return Array.from(cats).sort();
  });

  // Método para manejar cambios en input de búsqueda
  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject.next(value); // Trigger debounce
    this.currentPage.set(1);
  }

  isDialogOpen = signal(false);
  editingProductId = signal<string | null>(null); // Producto que se está editando
  modalTitle = computed(() => (this.editingProductId() ? 'Editar Producto' : 'Nuevo Producto'));

  // Señales para el formulario de creación/edición
  productName = signal('');
  productCategory = signal('General');
  productBrand = signal('');
  productBarcode = signal('');
  initialStock = signal(0);
  // Configuración de Generación de Variantes (Estilo Stripe)
  globalAlmacenId = signal<string>(''); // Almacén por defecto
  isAlmacenDropdownOpen = signal(false);
  
  globalAlmacenName = computed(() => {
    const id = this.globalAlmacenId();
    if (!id) return 'Selecciona un almacén principal...';
    const found = this.almacenes().find((a) => String(a.id) === String(id));
    return found ? found.nombre : 'Selecciona un almacén principal...';
  });

  selectGlobalAlmacen(id: string | undefined) {
    if (id) {
      this.globalAlmacenId.set(String(id));
    }
    this.isAlmacenDropdownOpen.set(false);
  }

  selectedColors = signal<string[]>([]); // Colores seleccionados para generar
  selectedSizes = signal<string[]>([]); // Tallas seleccionadas para generar

  costPrice = signal(0);
  salePrice = signal(0);
  selectedImage = signal<string | null>(null);
  variants = signal<ProductVariant[]>([]); // Variantes generadas
  expandedProductId = signal<string | null>(null); // Para expandir/contraer variantes en cards

  //  Paginación y Modales
  currentPage = signal(1);
  pageSize = signal(10);
  activeModalTab = signal<'INFO' | 'VARIANTS' | 'FINANCE'>('INFO');
  expandedTableProductId = signal<string | null>(null);

  // Tallas y colores disponibles
  availableSizes = ['34','35', '36', '37', '38', '39', '40', '41', '42', '43'];
  availableColors = ['Negro', 'Blanco', 'Gris', 'Azul', 'Rojo', 'Marrón', 'Beige', 'Vino'];

  // Computed: Colores únicos que tienen variantes
  activeColorsWithVariants = computed(() => {
    const colors = new Set(this.variants().map((v) => v.color));
    return Array.from(colors);
  });

  // Computed: Tallas únicas generadas en la matriz
  activeSizes = computed(() => {
    const sizes = new Set(this.variants().map((v) => v.size));
    return Array.from(sizes).sort((a, b) => Number(a) - Number(b));
  });

  // Computed: Ganancia y margen en tiempo real
  profit = computed(() => this.salePrice() - this.costPrice());
  margin = computed(() => {
    if (this.salePrice() === 0) return 0;
    return ((this.profit() / this.salePrice()) * 100).toFixed(1);
  });

  // 🆕 Estadísticas Globales para Bento Grid
  statsCriticalStock = computed(() => {
    return this.products().filter((p) => p.stock <= (p.minStock || 5)).length;
  });

  statsTotalValue = computed(() => {
    return this.products().reduce((acc, p) => acc + p.stock * p.cost, 0);
  });

  // Computed: Validación del formulario
  isFormValid = computed(() => {
    return (
      this.productName().trim().length > 0 &&
      this.costPrice() > 0 &&
      this.salePrice() > 0 &&
      this.salePrice() > this.costPrice() &&
      this.variants().length > 0 &&
      this.variants().every((v) => v.stock >= 0)
    );
  });

  // Computed: Stock total de todas las variantes
  totalStock = computed(() => {
    return this.variants().reduce((sum, v) => sum + v.stock, 0);
  });

  // Computed: Filtrar productos por búsqueda (con debounce) y filtros
  filteredProducts = computed(() => {
    let filtered = this.products();

    // Filtrar por categoría si está seleccionada
    const category = this.selectedCategory();
    if (category) {
      filtered = filtered.filter((p) => p.category === category);
    }

    // Filtrar por género si está seleccionado (asumiendo que tienes un campo 'gender' en el producto)
    const gender = this.selectedGender();
    if (gender) {
      // Si no tienes un campo 'gender', puedes usar categorías o nombre
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(gender.toLowerCase()) ||
          p.category.toLowerCase().includes(gender.toLowerCase()),
      );
    }

    // Filtrar por búsqueda
    const query = this.debouncedSearch().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (p) => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query),
      );
    }

    return filtered;
  });

  // 🆕 Computed: Determinar si hay filtros activos
  hasActiveFilters = computed(() => {
    return !!this.selectedCategory() || !!this.selectedGender() || !!this.searchQuery();
  });

  // Computed: Productos Paginados
  paginatedProducts = computed(() => {
    const products = this.filteredProducts();
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return products.slice(start, end);
  });

  // Computed: Total de páginas
  totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.filteredProducts().length / this.pageSize()));
  });

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
    }
  }

  onPageSizeChange(event: Event) {
    const size = parseInt((event.target as HTMLSelectElement).value, 10);
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  generateBarcode() {
    this.productBarcode.set(`BAR-${Math.floor(Math.random() * 1000000)}`);
  }

  // 🆕 MÉTODOS DE UI AVANZADA (Selección, Vista, Dropdown)

  toggleViewMode(mode: 'list' | 'grid') {
    this.viewMode.set(mode);
  }

  toggleSelection(productId: string) {
    const current = this.selectedProducts();
    if (current.includes(productId)) {
      this.selectedProducts.set(current.filter((id) => id !== productId));
    } else {
      this.selectedProducts.set([...current, productId]);
    }
  }

  toggleAllSelection() {
    const currentPaginated = this.paginatedProducts().map((p) => p.id);
    const selected = this.selectedProducts();
    const allVisibleSelected = currentPaginated.every((id) => selected.includes(id));

    if (allVisibleSelected) {
      this.selectedProducts.set(selected.filter((id) => !currentPaginated.includes(id)));
    } else {
      const newSelection = Array.from(new Set([...selected, ...currentPaginated]));
      this.selectedProducts.set(newSelection);
    }
  }

  isAllSelected(): boolean {
    const currentPaginated = this.paginatedProducts();
    if (currentPaginated.length === 0) return false;
    return currentPaginated.every((p) => this.selectedProducts().includes(p.id));
  }

  clearSelection() {
    this.selectedProducts.set([]);
  }

  toggleDropdown(productId: string, event: Event) {
    event.stopPropagation();
    this.activeDropdownId.set(this.activeDropdownId() === productId ? null : productId);
  }

  closeDropdowns() {
    this.activeDropdownId.set(null);
  }

  // 🆕 Drag & Drop de Imágenes
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        this.handleFile(file);
      }
    }
  }

  // MÉTODOS

  /**
   * Aplicar filtro de categoría
   */
  applyCategory(category: string) {
    // Toggle: Si ya está seleccionada, deseleccionar
    if (this.selectedCategory() === category) {
      this.clearFilters();
      return;
    }
    this.selectedCategory.set(category);
    this.currentPage.set(1);
  }

  /**
   * Ver todos los productos (sin filtros)
   */
  viewAllProducts() {
    this.clearFilters();
  }

  /**
   * Limpiar filtros activos
   */
  clearFilters() {
    this.selectedCategory.set(null);
    this.selectedGender.set(null);
    this.searchQuery.set('');
    this.debouncedSearch.set('');
    this.currentPage.set(1);
  }

  /**
   * Abrir modal para crear un nuevo producto
   */
  openCreate() {
    this.editingProductId.set(null);
    this.resetForm();
    this.activeModalTab.set('INFO');
    this.isDialogOpen.set(true);
  }

  /**
   * Abrir modal para editar un producto existente
   */
  openEdit(productId: string) {
    const product = this.products().find((p) => p.id === productId);
    if (!product) return;

    this.editingProductId.set(productId);
    this.productName.set(product.name);
    this.productBrand.set(product.brand || '');
    this.productBarcode.set(product.barcode || '');
    this.productCategory.set(product.category);
    this.costPrice.set(product.cost);
    this.salePrice.set(product.price);
    this.selectedImage.set(product.image || null);

    // Cargar variantes existentes
    if (product.variants && product.variants.length > 0) {
      this.variants.set([...product.variants]);
    } else {
      // Si no hay variantes, inicializar vacío
      this.variants.set([]);
    }

    this.activeModalTab.set('INFO');
    this.isDialogOpen.set(true);
  }

  /**
   * Resetear el formulario a valores iniciales
   */
  private resetForm() {
    this.productName.set('');
    this.productBrand.set('');
    this.productBarcode.set('');
    this.productCategory.set('General');
    this.costPrice.set(0);
    this.salePrice.set(0);
    this.selectedImage.set(null);
    this.variants.set([]);
  }

  /**
   * Toggle color en la configuración de generación
   */
  toggleSelectedColor(color: string) {
    const current = this.selectedColors();
    if (current.includes(color)) {
      this.selectedColors.set(current.filter((c) => c !== color));
    } else {
      this.selectedColors.set([...current, color]);
    }
  }

  /**
   * Toggle talla en la configuración de generación
   */
  toggleSelectedSize(size: string) {
    const current = this.selectedSizes();
    if (current.includes(size)) {
      this.selectedSizes.set(current.filter((s) => s !== size));
    } else {
      this.selectedSizes.set([...current, size]);
    }
  }

  /**
   * Generar la matriz de variantes basada en las selecciones
   */
  generateMatrix() {
    const colors = this.selectedColors();
    const sizes = this.selectedSizes();
    const currentVariants = this.variants();
    const newVariants: ProductVariant[] = [];
    const almacenId = this.globalAlmacenId() || undefined;
    const almacenName = this.almacenes().find((a) => String(a.id) === String(almacenId))?.nombre;

    colors.forEach((color) => {
      sizes.forEach((size) => {
        // Verificar si la variante ya existe
        const exists = currentVariants.some((v) => v.color === color && v.size === size);
        if (!exists) {
          newVariants.push({
            id: crypto.randomUUID(),
            color,
            size,
            stock: 0,
            barcode: '',
            almacenId,
            almacenName,
          });
        }
      });
    });

    // Agregar las nuevas variantes al INICIO de la lista existente
    this.variants.set([...newVariants, ...currentVariants]);
    // Limpiamos la selección para permitir generar nuevas combinaciones después si quieren
    this.selectedColors.set([]);
    this.selectedSizes.set([]);
  }

  /**
   * Limpiar la matriz generada
   */
  clearVariants() {
    this.variants.set([]);
  }

  /**
   * Eliminar una variante específica de la matriz
   */
  removeVariant(variantId: string) {
    const updated = this.variants().filter((v) => v.id !== variantId);
    this.variants.set(updated);
  }

  /**
   * Actualizar stock de una variante específica
   */
  updateVariantStock(variantId: string, stock: number) {
    const updated = this.variants().map((v) =>
      v.id === variantId ? { ...v, stock: Math.max(0, stock) } : v,
    );
    this.variants.set(updated);
  }

  updateVariantBarcode(variantId: string, barcode: string) {
    const updated = this.variants().map((v) => (v.id === variantId ? { ...v, barcode } : v));
    this.variants.set(updated);
  }

  updateVariantAlmacen(variantId: string, almacenId: string) {
    const almacenName = this.almacenes().find((a: Almacen) => a.id === almacenId)?.nombre || '';
    const updated = this.variants().map((v) =>
      v.id === variantId ? { ...v, almacenId: almacenId || undefined, almacenName } : v,
    );
    this.variants.set(updated);
  }

  /**
   * Toggle expandir/contraer variantes de un producto
   */
  toggleProductVariants(productId: string) {
    this.expandedProductId.set(this.expandedProductId() === productId ? null : productId);
  }

  /**
   * Toggle expandir/contraer fila de tabla para ver variantes
   */
  toggleTableRow(productId: string) {
    this.expandedTableProductId.set(this.expandedTableProductId() === productId ? null : productId);
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  private handleFile(file: File) {
    this.selectedFile.set(file);
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedImage.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async saveProduct() {
    if (!this.isFormValid()) {
      alert('Por favor completa todos los campos correctamente y asigna stock a las variantes');
      return;
    }

    const editingId = this.editingProductId();
    const totalStock = this.totalStock();
    const allVariants = this.variants();

    // Extraer tallas y colores únicos de las variantes
    const uniqueSizes = Array.from(new Set(allVariants.map((v) => v.size)));
    const uniqueColors = Array.from(new Set(allVariants.map((v) => v.color)));

    // 🖼️ Subir imagen a Cloudinary si hay un archivo nuevo
    let imageUrl = this.selectedImage();
    const file = this.selectedFile();

    if (file && this.cloudinary.isConfigured()) {
      try {
        this.isUploadingImage.set(true);
        console.log('📤 Subiendo imagen a Cloudinary...');

        const publicId = editingId || `producto-${Date.now()}`;
        const result = await this.cloudinary.uploadImage(file, publicId, (progress) =>
          this.uploadProgress.set(progress.percentage),
        );

        imageUrl = result.url;
        console.log('✅ Imagen subida:', imageUrl);
      } catch (error) {
        console.error('❌ Error subiendo imagen:', error);
        alert('Error al subir la imagen. Se guardará sin imagen.');
        imageUrl = '/images/placeholder-product.svg';
      } finally {
        this.isUploadingImage.set(false);
        this.uploadProgress.set(0);
      }
    }

    if (editingId) {
      // Actualizar producto existente
      const success = this.productService.updateProduct(editingId, {
        name: this.productName(),
        brand: this.productBrand(),
        barcode: this.productBarcode(),
        category: this.productCategory(),
        price: this.salePrice(),
        cost: this.costPrice(),
        stock: totalStock,
        sizes: uniqueSizes,
        colors: uniqueColors,
        variants: allVariants,
        image: imageUrl || undefined,
      });

      if (success) {
        this.isDialogOpen.set(false);
        this.resetForm();
      }
    } else {
      // Crear nuevo producto
      const newProduct = {
        name: this.productName(),
        category: this.productCategory(),
        brand: this.productBrand() || 'DENFAR',
        price: this.salePrice(),
        cost: this.costPrice(),
        stock: totalStock,
        minStock: 5,
        sizes: uniqueSizes,
        colors: uniqueColors,
        variants: allVariants,
        barcode: this.productBarcode() || `BAR-${Date.now()}`,
        image: imageUrl || '/images/placeholder-product.svg',
        status: 'active' as const,
      };

      this.productService.addProduct(newProduct);
      this.isDialogOpen.set(false);
      this.resetForm();
    }
  }

  async handleAction(action: string, id: string) {
    if (action === 'delete') {
      this.confirmData.set({
        title: 'Archivar Producto',
        message:
          '¿Estás seguro de archivar este producto? No se eliminará si tiene ventas asociadas, solo se ocultará del catálogo principal.',
        actionLabel: 'Archivar Producto',
        isDestructive: true,
        onConfirm: async () => {
          const success = await this.productService.deleteProduct(id);
          if (success) {
            this.toastService.success('Producto archivado correctamente');
          } else {
            this.toastService.error('Error al archivar el producto');
          }
          this.closeConfirmDialog();
        },
      });
      this.isConfirmDialogOpen.set(true);
    }
  }

  // Acciones en Lote (Bulk Actions)
  async deleteSelectedProducts() {
    const selectedIds = this.selectedProducts();
    if (selectedIds.length === 0) return;

    this.confirmData.set({
      title: 'Archivar Múltiples Productos',
      message: `¿Estás seguro de archivar ${selectedIds.length} productos? Esta acción los ocultará del catálogo principal.`,
      actionLabel: `Archivar ${selectedIds.length} Productos`,
      isDestructive: true,
      onConfirm: async () => {
        let successCount = 0;
        for (const id of selectedIds) {
          const success = await this.productService.deleteProduct(id);
          if (success) successCount++;
        }

        if (successCount === selectedIds.length) {
          this.toastService.success(`Se archivaron ${successCount} productos correctamente`);
        } else {
          this.toastService.warning(
            `Se archivaron ${successCount} de ${selectedIds.length} productos`,
          );
        }

        this.clearSelection();
        this.closeConfirmDialog();
      },
    });
    this.isConfirmDialogOpen.set(true);
  }

  closeConfirmDialog() {
    this.isConfirmDialogOpen.set(false);
    setTimeout(() => this.confirmData.set(null), 300); // Wait for animation
  }

  // Helpers para actualizar valores del formulario
  updateCost(val: string) {
    this.costPrice.set(parseFloat(val) || 0);
  }

  updateSale(val: string) {
    this.salePrice.set(parseFloat(val) || 0);
  }

  updateName(val: string) {
    this.productName.set(val);
  }

  updateCategory(val: string) {
    this.productCategory.set(val);
  }

  /**
   * Obtener variantes de un color específico
   */
  getVariantsByColor(color: string): ProductVariant[] {
    return this.variants().filter((v) => v.color === color);
  }

  /**
   * Contar variantes de un color específico
   */
  countVariantsByColor(color: string): number {
    return this.variants().filter((v) => v.color === color).length;
  }

  /**
   * Contar productos por categoría
   */
  countProductsByCategory(category: string): number {
    return this.products().filter((p) => p.category === category).length;
  }

  /**
   * Obtener icono Material para una categoría
   */
  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      General: 'inventory_2',
      Zapatillas: 'directions_run',
      Zapatos: 'steps',
      Botas: 'snowshoeing',
      Sandalias: 'surfing',
      Deportivo: 'sprint',
      Accesorios: 'diamond',
    };
    return icons[category] || 'category';
  }
}
