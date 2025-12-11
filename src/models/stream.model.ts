import { Stream } from 'stream';

export { Readable, Duplex } from 'stream';

export interface ExcelStreamResponse {
  stream?: Stream;
  filename?: string;
}
