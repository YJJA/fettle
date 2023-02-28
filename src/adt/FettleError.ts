class BaseFettleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FettleError";
  }
}

class NodeMissingError extends BaseFettleError {
  constructor(message: string) {
    super(message);
    this.name = "NodeMissingError";
  }
}

class ReadOnlyStateError extends BaseFettleError {
  constructor(message: string) {
    super(message);
    this.name = "ReadOnlyStateError";
  }
}

export type FettleErrorType = NodeMissingError | ReadOnlyStateError;

namespace FettleError {
  export function err(message: string) {
    return new BaseFettleError(message);
  }

  export function nodeMissing(message: string) {
    return new NodeMissingError(message);
  }

  export function readOnly(message: string) {
    return new ReadOnlyStateError(message);
  }

  export function isFettleError(payload: unknown): payload is FettleErrorType {
    return payload instanceof BaseFettleError;
  }
}

export default FettleError;
