import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Almacen } from '../models';

@Injectable({
  providedIn: 'root'
})
export class AlmacenService {
  private api = inject(ApiService);

  getAlmacenes(): Observable<Almacen[]> {
    return this.api.get<Almacen[]>('almacenes');
  }

  getAlmacenById(id: string): Observable<Almacen> {
    return this.api.get<Almacen>(`almacenes/${id}`);
  }

  crearAlmacen(almacen: Almacen): Observable<Almacen> {
    return this.api.post<Almacen>('almacenes', almacen);
  }

  actualizarAlmacen(id: string, almacen: Almacen): Observable<Almacen> {
    return this.api.put<Almacen>(`almacenes/${id}`, almacen);
  }

  eliminarAlmacen(id: string): Observable<void> {
    return this.api.delete<void>(`almacenes/${id}`);
  }
}
