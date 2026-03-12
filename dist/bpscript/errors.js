// BPscript error types with source location

export class BPScriptError extends Error {
  constructor(message, line, col) {
    super(message);
    this.name = 'BPScriptError';
    this.line = line;
    this.col = col;
  }

  toString() {
    return `${this.name} (line ${this.line}, col ${this.col}): ${this.message}`;
  }
}

export class TokenError extends BPScriptError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = 'TokenError';
  }
}

export class ParseError extends BPScriptError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = 'ParseError';
  }
}

export class CompileError extends BPScriptError {
  constructor(message, line, col) {
    super(message, line, col);
    this.name = 'CompileError';
  }
}
