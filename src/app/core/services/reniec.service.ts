import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PersonaReniec {
  numeroDocumento: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  tipoDocumento: string;
  nombreCompleto: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReniecService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/v1/consultas`;

  /**
   * Consulta los datos de una persona por su DNI a través del backend en Spring Boot.
   * @param dni DNI de 8 dígitos
   */
  consultarDni(dni: string): Observable<PersonaReniec> {
    return this.http.get<PersonaReniec>(`${this.apiUrl}/dni/${dni}`);
  }
}
