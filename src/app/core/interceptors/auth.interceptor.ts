import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";

import { environment } from "../../../environments/environment";

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  const router = inject(Router);
  const token = localStorage.getItem('denraf_token');

  // Solo agrega token en llamadas al backend usando la URL configurada
  const isBackendUrl = req.url.startsWith(environment.apiUrl);
        
  const isAuthUrl = req.url.includes('/api/auth/');

  const authReq = token && isBackendUrl && !isAuthUrl ? req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  }) : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401: Unauthorized (Token expirado o inválido) -> Desloguear
      // 403: Forbidden (Token válido pero sin permisos) -> NO desloguear
      if (error.status === 401 && isBackendUrl) {
        localStorage.removeItem('denraf_token');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};