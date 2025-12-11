import { ApiResponse, ApiError, PaginationInfo } from '@/models';

const prepareResponse = <T>(
  status: number,
  message: string | null,
  data?: T | null,
  pagination?: PaginationInfo,
  errors?: ApiError[]
): ApiResponse<T> => ({
  status,
  message,
  data,
  pagination,
  errors,
});

export default prepareResponse;
