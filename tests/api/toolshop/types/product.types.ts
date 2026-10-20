// The contract marks no field as required, but Toolshop needs all of them to create a product.
export type CreateProductRequest = {
  name: string;
  description: string;
  price: number;
  category_id: string;
  brand_id: string;
  product_image_id: string;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
};
