import prepareResponse from '../api-response';

describe('prepareResponse', () => {
  it('should prepare a response with status and message', () => {
    const response = prepareResponse(200, 'Success');
    expect(response).toEqual({
      status: 200,
      message: 'Success',
      data: undefined,
      pagination: undefined,
      errors: undefined,
    });
  });

  it('should prepare a response with data', () => {
    const data = { id: 1, name: 'Test' };
    const response = prepareResponse(200, 'Success', data);
    expect(response).toEqual({
      status: 200,
      message: 'Success',
      data,
      pagination: undefined,
      errors: undefined,
    });
  });

  it('should prepare a response with pagination and errors', () => {
    const data = { id: 1 };
    const pagination = { page: 1, page_size: 10, totalPages: 5, totalCount: 50 };
    const errors = [{ key: 'some_error', message: 'Some error' }];
    const response = prepareResponse(400, 'Error', data, pagination, errors);
    expect(response).toEqual({
      status: 400,
      message: 'Error',
      data,
      pagination,
      errors,
    });
  });

  it('should handle null values for message and data', () => {
    const response = prepareResponse(204, null, null);
    expect(response).toEqual({
      status: 204,
      message: null,
      data: null,
      pagination: undefined,
      errors: undefined,
    });
  });
});
