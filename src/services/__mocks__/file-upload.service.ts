export const fileUploadService = {
    resolveClassFiles: jest.fn(),
    cleanupAssembledFilesMappings: jest.fn(),
    resolveClassFilesForUpdate: jest.fn(),
    deleteFiles: jest.fn(),
    getVideoStream: jest.fn(),
    processChunk: jest.fn(),
    finalizeChunks: jest.fn(),
    cleanupChunks: jest.fn(),
    findAssembledFile: jest.fn(),
    resolveFileName: jest.fn(),
    deleteFile: jest.fn(),
};

export class FileUploadService {
    processChunk = jest.fn();
    finalizeChunks = jest.fn();
    cleanupChunks = jest.fn();
    findAssembledFile = jest.fn();
    resolveFileName = jest.fn();
    deleteFile = jest.fn();
    cleanupAssembledFilesMappings = jest.fn();
    resolveClassFiles = jest.fn();
    resolveClassFilesForUpdate = jest.fn();
    deleteFiles = jest.fn();
    getVideoStream = jest.fn();
}
