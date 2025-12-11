class Error {
  message: string;

  key: string;

  constructor(message: string, key: string) {
    this.key = key;
    this.message = message;
  }
}

export default Error;
