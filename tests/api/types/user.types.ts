export type CreateUserRequest = {
  name: string;
  email: string;
  gender: "male" | "female";
  status: "active" | "inactive";
};

export type UpdateUserRequest = {
  name: string;
  status: "active" | "inactive";
};
