import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ServerStatusService } from '../services/server-status.service';

export const serverErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const serverStatus = inject(ServerStatusService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504) {
        serverStatus.markDown();
      }
      return throwError(() => error);
    })
  );
};
