import type { StandardSchemaV1 } from './standard';

export class RouteError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'RouteError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, RouteError.prototype);
  }
}

export class RouteValidationError extends Error {
  public issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super('Validation failed');
    this.name = 'RouteValidationError';
    this.issues = issues;
    Object.setPrototypeOf(this, RouteValidationError.prototype);
  }
}
