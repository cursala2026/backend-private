// This file runs very early in the Jest worker process.
// Register an unhandledRejection handler to print detailed info for debugging.
process.on('unhandledRejection', (reason) => {
  try {
    // eslint-disable-next-line no-console
    console.error('EARLY unhandledRejection captured by jest.pre-setup.ts:', reason);
    if (reason && typeof reason === 'object') {
      // eslint-disable-next-line no-console
      console.error('Reason keys:', Object.keys(reason));
      // eslint-disable-next-line no-console
      console.error('Reason inspect:', JSON.stringify(reason, Object.getOwnPropertyNames(reason), 2));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Error while logging unhandledRejection:', e);
  }
});
