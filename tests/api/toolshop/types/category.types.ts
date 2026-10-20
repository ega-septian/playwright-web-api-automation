export type CreateCategoryRequest = {
  name: string;
  slug: string;
  parent_id?: string | null;
};
