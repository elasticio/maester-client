/* eslint-disable max-classes-per-file */
export class ObjectStorageClientError extends Error {
  public cause: Error;

  public constructor(message: string, options?: { cause?: Error }) {
    // "options" is supported in nodejs 16+, so suppress the compiler error
    super(message);
    this.name = 'ObjectStorageClientError';
    // backward-compatibility for nodejs < 16
    if (!this.cause) {
      this.cause = options?.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TransportError extends ObjectStorageClientError {
  public constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'TransportError';
  }
}

export class ClientTransportError extends TransportError {
  public code: number;

  public constructor(message: string, code: number, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'ClientTransportError';
    this.code = code;
  }
}

export class ServerTransportError extends TransportError {
  public code: number;

  public constructor(message: string, { code, cause }: { code?: number, cause?: Error }) {
    super(message, { cause });
    this.name = 'ServerTransportError';
    this.code = code;
  }
}

export class PotentiallyConsumedStreamError extends ObjectStorageClientError {
  public constructor(message: string) {
    super(message);
    this.name = 'PotentiallyConsumedStreamError';
  }
}

export class JwtNotProvidedError extends ObjectStorageClientError {
  public constructor(message: string) {
    super(message);
    this.name = 'JwtNotProvidedError';
  }
}

export class InternalError extends ObjectStorageClientError {
  public constructor(message: string, options?: { cause?: Error }) {
    super(message, options);
    this.name = 'InternalError';
  }
}
