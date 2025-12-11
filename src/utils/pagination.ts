const isNumber = (value: string | number) =>
  !Number.isNaN(parseFloat(value as string)) && Number.isFinite(Number(value));

const getNumberIfValid = (value: string | number) => (isNumber(value) ? parseFloat(value as string) : null);

const getNumberIfPositive = (value: number | string) => {
  const number = getNumberIfValid(value);
  return number && number >= 0 ? number : null;
};

// Pagination
// TODO: Once we define the correct pagination interface, we need to add it here.
const paginate = (params: Record<string, unknown> | undefined) => {
  let limit = 10;
  let page = 1;
  if (!params) {
    return { limit, page };
  }
  if (params.page && params.page_size) {
    page = getNumberIfPositive(params.page as number | string) || page;
    limit = getNumberIfPositive(params.page_size as number | string) || limit;
  }
  return { limit, page };
};

// Sorting
const sortBy = (params: Record<string, unknown> | undefined) => {
  let sort = 'updatedAt';
  let dir = -1;
  if (params?.sort) {
    sort = params.sort as string;
  }
  if (params?.sort_dir) {
    dir = (params.sort_dir as string) === 'ASC' ? 1 : -1;
  }
  return { sort, dir };
};

export { paginate, sortBy };
