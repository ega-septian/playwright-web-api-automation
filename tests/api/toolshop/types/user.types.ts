export type RegisterUserRequest = {
  first_name: string;
  last_name: string;
  address?: Address;
  phone?: string;
  dob?: string; // "YYYY-MM-DD"
  password: string;
  email: string;
};

export type Address = {
  street?: string;
  house_number?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
};
