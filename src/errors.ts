import type { StandardSchemaV1 } from './standard';

/**
 * Custom error class for expected business logic and API errors.
 *
 * @example
 * throw new RouteError('Unauthorized access', 401);
 */
export class RouteError extends Error {
  /**
   * The HTTP status code associated with the error.
   */
  public statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'RouteError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, RouteError.prototype);
  }
}

/**
 * Custom error class thrown when schema validation fails.
 * Contains the list of validation issues returned by the schema library.
 *
 * @example
 * throw new RouteValidationError([{ message: 'Invalid email address', path: ['email'] }]);
 */
export class RouteValidationError extends Error {
  /**
   * The list of validation issues.
   */
  public issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super('Validation failed');
    this.name = 'RouteValidationError';
    this.issues = issues;
    Object.setPrototypeOf(this, RouteValidationError.prototype);
  }
}
